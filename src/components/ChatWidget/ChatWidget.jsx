import { useState, useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../../hooks/useAuth';
import { fetchMyChat, sendMyMessage, markMyMessagesRead, fetchGuestChat, markGuestMessagesRead, getOrCreateGuestId } from '../../api/chat';
import './ChatWidget.css';

const TOKEN_KEY = 'autosite_token';
const WELCOME_TEXT = 'Здравствуйте! Чем могу помочь? Задайте любой вопрос по автомобилям, доставке или оплате.';

function formatTime(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function ChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const [roomId, setRoomId] = useState(null);
  const [typing, setTyping] = useState(false);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const autoOpenedRef = useRef(false);
  const isOpenRef = useRef(isOpen);
  const typingTimerRef = useRef(null);
  const audioCtxRef = useRef(null);

  /* ── notification sound (Web Audio API) ── */
  const playNotificationSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* audio not available */ }
  }, []);

  // Keep ref in-sync with state
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  /* ── scroll to bottom ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── auto-open after 3 s ── */
  useEffect(() => {
    if (autoOpenedRef.current) return;
    const t = setTimeout(() => { setIsOpen(true); autoOpenedRef.current = true; }, 3000);
    return () => clearTimeout(t);
  }, []);

  /* ── load history + open socket ── */
  useEffect(() => {
    let cancelled = false;

    const isGuest = !user;
    const guestId = isGuest ? getOrCreateGuestId() : null;

    (async () => {
      try {
        const data = isGuest ? await fetchGuestChat() : await fetchMyChat();
        if (cancelled) return;
        if (data.room) setRoomId(data.room.id);
        const mapped = data.messages.map(m => ({
          id: m.id,
          from: m.is_admin_reply ? 'manager' : 'user',
          text: m.text,
          time: formatTime(m.created_at),
        }));
        // Inject welcome greeting if chat history is empty
        if (mapped.length === 0) {
          mapped.unshift({
            id: 'welcome',
            from: 'manager',
            text: WELCOME_TEXT,
            time: formatTime(null),
          });
          setTimeout(() => playNotificationSound(), 100);
        }
        setMessages(mapped);
        // count unread from admin
        const unreadCount = data.messages.filter(m => m.is_admin_reply && !m.is_read).length;
        setUnread(unreadCount);
      } catch {
        /* first open, no room yet — show welcome anyway */
        if (!cancelled) {
          setMessages([{
            id: 'welcome',
            from: 'manager',
            text: WELCOME_TEXT,
            time: formatTime(null),
          }]);
          setTimeout(() => playNotificationSound(), 100);
        }
      }
    })();

    // socket
    const token = localStorage.getItem(TOKEN_KEY);
    const socketAuth = token && !isGuest ? { token } : { guestId };

    const socket = io(window.location.origin, {
      auth: socketAuth,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('chat:message', (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, {
          id: msg.id,
          from: msg.is_admin_reply ? 'manager' : 'user',
          text: msg.text,
          time: formatTime(msg.created_at),
        }];
      });
      // if it's from admin and chat is closed — bump unread + play sound
      if (msg.is_admin_reply && !isOpenRef.current) {
        setUnread(u => u + 1);
        playNotificationSound();
      }
      // if chat is open, mark read immediately
      if (msg.is_admin_reply && isOpenRef.current) {
        const markRead = localStorage.getItem(TOKEN_KEY) ? markMyMessagesRead : markGuestMessagesRead;
        markRead().catch(() => {});
      }
    });

    socket.on('chat:typing', ({ userId: typingUserId }) => {
      const myId = user?.id;
      if (typingUserId !== myId) {
        setTyping(true);
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setTyping(false), 2000);
      }
    });

    socket.on('chat:read', () => {
      // admin read our messages — could add double-check mark later
    });

    return () => {
      cancelled = true;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, playNotificationSound]);

  /* ── when chat opens, mark messages read ── */
  useEffect(() => {
    if (isOpen && roomId) {
      const markRead = user ? markMyMessagesRead : markGuestMessagesRead;
      markRead().then(() => setUnread(0)).catch(() => {});
    }
  }, [isOpen, user, roomId]);

  /* ── send message ── */
  const handleSend = useCallback(async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !socketRef.current) return;

    /* If no room yet — create it by sending the first message via REST API */
    if (!roomId) {
      try {
        const isGuest = !user;
        const res = isGuest
          ? await (await fetch('/api/chat/guest/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-guest-id': getOrCreateGuestId() },
              body: JSON.stringify({ text }),
            })).json()
          : await sendMyMessage(text);
        const msg = res.message;
        const newRoomId = msg.room_id;
        setRoomId(newRoomId);
        setMessages(prev => [
          ...prev,
          { id: msg.id, from: 'user', text: msg.text, time: formatTime(msg.created_at) },
        ]);
        socketRef.current.emit('chat:join', { roomId: newRoomId });
        setInput('');
      } catch (err) {
        console.error('First message send error:', err);
      }
      return;
    }

    socketRef.current.emit('chat:send', { roomId, text });
    setInput('');
  }, [input, roomId, user]);

  /* ── typing indicator ── */
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (socketRef.current && roomId) {
      socketRef.current.emit('chat:typing', { roomId });
    }
  };

  /* ── open / close ── */
  const handleOpen = () => {
    setIsOpen(true);
    setUnread(0);
  };
  const handleClose = () => setIsOpen(false);

  return (
    <>
      {/* Chat window */}
      <div className={`chat-widget ${isOpen ? 'chat-widget--open' : ''}`}>
        {/* Header */}
        <div className="chat-widget__header">
          <div className="chat-widget__header-info">
            <div className="chat-widget__avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <div className="chat-widget__manager-name">Менеджер</div>
              <div className="chat-widget__status">
                <span className={`chat-widget__status-dot${connected ? '' : ' chat-widget__status-dot--offline'}`}></span>
                {connected ? 'Онлайн' : 'Не в сети'}
              </div>
            </div>
          </div>
          <button className="chat-widget__close" onClick={handleClose} aria-label="Закрыть чат">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="chat-widget__messages">
          {messages.length === 0 && (
            <div className="chat-widget__msg chat-widget__msg--manager">
              <div className="chat-widget__msg-bubble">{WELCOME_TEXT}</div>
            </div>
          )}
          {messages.map((msg, i) => {
            const showLabel = i === 0 || messages[i - 1].from !== msg.from;
            return (
              <div
                key={msg.id}
                className={`chat-widget__msg ${msg.from === 'user' ? 'chat-widget__msg--user' : 'chat-widget__msg--manager'}`}
              >
                {showLabel && (
                  <span className="chat-widget__msg-sender">
                    {msg.from === 'manager' ? 'Менеджер' : 'Вы'}
                  </span>
                )}
                <div className="chat-widget__msg-bubble">{msg.text}</div>
                <span className="chat-widget__msg-time">{msg.time}</span>
              </div>
            );
          })}
          {typing && (
            <div className="chat-widget__msg chat-widget__msg--manager">
              <div className="chat-widget__msg-bubble chat-widget__msg-typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form className="chat-widget__input-area" onSubmit={handleSend}>
          <input
            type="text"
            className="chat-widget__input"
            placeholder="Напишите сообщение..."
            value={input}
            onChange={handleInputChange}
          />
          <button type="submit" className="chat-widget__send" aria-label="Отправить" disabled={!input.trim()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
      </div>

      {/* Floating button */}
      <button
        className={`chat-widget__fab ${isOpen ? 'chat-widget__fab--hidden' : ''}`}
        onClick={handleOpen}
        aria-label="Открыть чат"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {unread > 0 && <span className="chat-widget__badge">{unread}</span>}
      </button>
    </>
  );
}

export default ChatWidget;
