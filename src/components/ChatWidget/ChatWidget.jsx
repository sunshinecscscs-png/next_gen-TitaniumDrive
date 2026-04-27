import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchMyChat, sendMyMessage, markMyMessagesRead,
  fetchGuestChat, markGuestMessagesRead, getOrCreateGuestId,
  saveGuestContacts, rateMyChat, rateGuestChat,
} from '../../api/chat';
import { reachGoal } from '../../utils/ym';
import './ChatWidget.css';

const TOKEN_KEY = 'autosite_token';
const GUEST_CONTACTS_KEY = 'autosite_guest_contacts';
const PROACTIVE_DELAY = 1500;
const PROACTIVE_TEXT = 'Здравствуйте! Помочь подобрать автомобиль? 🚗';
const WELCOME_TEXT = 'Здравствуйте! 👋 Чем могу помочь? Задайте любой вопрос по автомобилям, доставке или оплате.';
const QUICK_REPLIES = [
  'Подбор авто по бюджету',
  'Условия доставки',
  'Как купить авто?',
  'Связаться с менеджером',
];

function formatTime(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ChatWidget() {
  const { user } = useAuth();
  const location = useLocation();

  /* ── Core chat state ── */
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const [roomId, setRoomId] = useState(null);
  const [typing, setTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);

  /* ── Proactive invitation ── */
  const [showBubble, setShowBubble] = useState(false);
  const hasEngaged = useRef(false);
  const [pingTrigger, setPingTrigger] = useState(0);

  /* ── Pre-chat form ── */
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('+7 ');
  const [formError, setFormError] = useState('');

  /* ── Determine initial phase ── */
  const [phase, setPhase] = useState(() => {
    if (!user && !localStorage.getItem(GUEST_CONTACTS_KEY)) return 'prechat';
    return 'chat';
  });

  /* ── Rating ── */
  const [showRating, setShowRating] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratedDone, setRatedDone] = useState(false);

  /* ── Operator info ── */
  const [operatorName, setOperatorName] = useState('Менеджер Юлия');

  /* ── Refs ── */
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isOpenRef = useRef(isOpen);
  const typingTimerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const pendingSoundRef = useRef(false);

  /* ── Unlock AudioContext on first user interaction ── */
  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        /* Create a silent buffer to unlock */
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        audioUnlockedRef.current = true;
        /* If sound was pending, play it now */
        if (pendingSoundRef.current) {
          pendingSoundRef.current = false;
          setTimeout(() => playSound(), 100);
        }
      } catch { /* ignore */ }
    };
    const events = ['click', 'touchstart', 'mousemove', 'scroll', 'keydown'];
    events.forEach(e => document.addEventListener(e, unlock, { once: false, passive: true }));
    return () => events.forEach(e => document.removeEventListener(e, unlock));
  }, []);

  /* ── Notification sound (Web Audio API) ── */
  const playSound = useCallback(() => {
    try {
      if (!audioCtxRef.current || !audioUnlockedRef.current) {
        pendingSoundRef.current = true;
        return;
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      /* First beep */
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc1.frequency.setValueAtTime(1175, ctx.currentTime + 0.08);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.25);
      /* Second beep */
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1047, ctx.currentTime + 0.3);
      osc2.frequency.setValueAtTime(1319, ctx.currentTime + 0.38);
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc2.start(ctx.currentTime + 0.3);
      osc2.stop(ctx.currentTime + 0.6);
    } catch { /* audio unavailable */ }
  }, []);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  /* ── Scroll to bottom ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  /* ── Proactive invitation bubble ── */
  useEffect(() => {
    if (hasEngaged.current) return;
    if (isOpen) return;
    const t = setTimeout(() => {
      setShowBubble(true);
      playSound();
    }, PROACTIVE_DELAY);
    return () => clearTimeout(t);
  }, [playSound, isOpen, pingTrigger]);

  /* ── Re-ping on page navigation (until user opens chat) ── */
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (hasEngaged.current) return;
    setShowBubble(false);
    setPingTrigger(c => c + 1);
  }, [location.pathname]);

  /* ── Load history + open socket ── */
  useEffect(() => {
    let cancelled = false;
    const isGuest = !user;
    const guestId = isGuest ? getOrCreateGuestId() : null;

    (async () => {
      try {
        const data = isGuest ? await fetchGuestChat() : await fetchMyChat();
        if (cancelled) return;

        if (data.room) {
          setRoomId(data.room.id);
          setPhase('chat');
          if (data.room.claimed_by_name) setOperatorName(data.room.claimed_by_name);
        }

        const mapped = data.messages.map(m => ({
          id: m.id,
          from: m.is_admin_reply ? 'operator' : 'user',
          text: m.text,
          time: formatTime(m.created_at),
          senderName: m.sender_name,
        }));

        if (mapped.length === 0) {
          mapped.unshift({
            id: 'welcome',
            from: 'operator',
            text: WELCOME_TEXT,
            time: formatTime(null),
          });
        } else {
          setShowQuickReplies(false);
        }

        setMessages(mapped);
        const uc = data.messages.filter(m => m.is_admin_reply && !m.is_read).length;
        setUnread(uc);
      } catch {
        if (!cancelled) {
          setMessages([{
            id: 'welcome',
            from: 'operator',
            text: WELCOME_TEXT,
            time: formatTime(null),
          }]);
        }
      }
    })();

    // Pre-chat phase for guests without saved contacts and no existing room
    // (handled by initial state)

    // Socket
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
          from: msg.is_admin_reply ? 'operator' : 'user',
          text: msg.text,
          time: formatTime(msg.created_at),
          senderName: msg.sender_name,
        }];
      });
      setShowQuickReplies(false);

      if (msg.is_admin_reply) {
        if (msg.sender_name) setOperatorName(msg.sender_name);
        if (!isOpenRef.current) {
          setUnread(u => u + 1);
          playSound();
        } else {
          const markFn = localStorage.getItem(TOKEN_KEY) ? markMyMessagesRead : markGuestMessagesRead;
          markFn().catch(() => {});
        }
      }
    });

    socket.on('chat:typing', ({ userId: tid }) => {
      if (tid !== user?.id) {
        setTyping(true);
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setTyping(false), 2000);
      }
    });

    socket.on('chat:read', () => {});

    return () => {
      cancelled = true;
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, playSound]);

  /* ── Mark read when opening ── */
  useEffect(() => {
    if (isOpen && roomId) {
      const markFn = user ? markMyMessagesRead : markGuestMessagesRead;
      markFn().then(() => setUnread(0)).catch(() => {});
    }
  }, [isOpen, user, roomId]);

  /* ── Send message (core) ── */
  const sendText = useCallback(async (text) => {
    if (!text?.trim() || !socketRef.current) return;

    if (!roomId) {
      try {
        const isGuest = !user;
        const cdata = JSON.parse(localStorage.getItem(GUEST_CONTACTS_KEY) || '{}');
        let res;
        if (isGuest) {
          const r = await fetch('/api/chat/guest/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-guest-id': getOrCreateGuestId() },
            body: JSON.stringify({
              text,
              guestName: cdata.name,
              guestPhone: cdata.phone,
              guestEmail: cdata.email,
              guestCity: cdata.city,
              guestCountry: cdata.country,
              guestCountryCode: cdata.countryCode,
            }),
          });
          res = await r.json();
          if (!r.ok) throw new Error(res.error || 'Ошибка сервера');
        } else {
          res = await sendMyMessage(text);
        }
        const msg = res.message;
        if (!msg) throw new Error('Нет данных сообщения');
        setRoomId(msg.room_id);
        setMessages(prev => [
          ...prev,
          { id: msg.id, from: 'user', text: msg.text, time: formatTime(msg.created_at) },
        ]);
        socketRef.current.emit('chat:join', { roomId: msg.room_id });
        reachGoal('chat_message_sent');
      } catch (err) {
        console.error('Send error:', err);
      }
      return;
    }

    socketRef.current.emit('chat:send', { roomId, text });
    reachGoal('chat_message_sent');
  }, [roomId, user]);

  /* ── Form handlers ── */
  const handleSend = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendText(text);
    setInput('');
    setShowQuickReplies(false);
  };

  const handleQuickReply = (text) => {
    sendText(text);
    setShowQuickReplies(false);
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (socketRef.current && roomId) {
      socketRef.current.emit('chat:typing', { roomId });
    }
  };

  /* ── Russian phone format: +7 (XXX) XXX-XX-XX ── */
  const formatRuPhone = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length === 0) return '+7 ';
    let result = '+7 ';
    const d = digits.startsWith('7') || digits.startsWith('8') ? digits.slice(1) : digits;
    if (d.length > 0) result += '(' + d.slice(0, 3);
    if (d.length >= 3) result += ') ';
    if (d.length > 3) result += d.slice(3, 6);
    if (d.length > 6) result += '-' + d.slice(6, 8);
    if (d.length > 8) result += '-' + d.slice(8, 10);
    return result;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatRuPhone(e.target.value);
    setFormPhone(formatted);
  };

  const handlePhoneKeyDown = (e) => {
    if (e.key === 'Backspace' && formPhone.length <= 3) e.preventDefault();
  };

  /* ── Pre-chat form submit ── */
  const handlePrechatSubmit = (e) => {
    e.preventDefault();
    const name = formName.trim();
    const phone = formPhone.trim();
    const phoneDigits = phone.replace(/\D/g, '');
    if (!name) { setFormError('Укажите ваше имя'); return; }
    if (phoneDigits.length !== 11) { setFormError('Введите корректный номер телефона'); return; }
    setFormError('');
    localStorage.setItem(GUEST_CONTACTS_KEY, JSON.stringify({ name, phone }));
    /* Detect location by IP */
    fetch('https://ipapi.co/json/').then(r => r.json()).then(geo => {
      const city = geo.city || '';
      const country = geo.country_name || '';
      const countryCode = geo.country_code || '';
      localStorage.setItem(GUEST_CONTACTS_KEY, JSON.stringify({ name, phone, city, country, countryCode }));
      saveGuestContacts(name, phone, '', city, country, countryCode).catch(() => {});
    }).catch(() => {
      saveGuestContacts(name, phone, '', '', '', '').catch(() => {});
    });
    setPhase('chat');
  };

  /* ── Rating ── */
  const handleRate = async (value) => {
    setRatingValue(value);
    try {
      if (user) {
        await rateMyChat(value);
      } else {
        await rateGuestChat(value);
      }
      setRatedDone(true);
      setTimeout(() => setShowRating(false), 2000);
    } catch { /* ignore */ }
  };

  /* ── Open / Close ── */
  const handleOpen = () => {
    hasEngaged.current = true;
    setIsOpen(true);
    setShowBubble(false);
    setUnread(0);
  };
  const handleClose = () => setIsOpen(false);
  const handleBubbleClose = (e) => {
    e.stopPropagation();
    setShowBubble(false);
    hasEngaged.current = true;
  };

  return (
    <>
      {/* ── Proactive invitation bubble ── */}
      {showBubble && !isOpen && (
        <div className="jchat-bubble" onClick={handleOpen}>
          <button className="jchat-bubble__close" onClick={handleBubbleClose} aria-label="Закрыть">×</button>
          <div className="jchat-bubble__avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span className="jchat-bubble__online-dot"></span>
          </div>
          <div className="jchat-bubble__body">
            <div className="jchat-bubble__name">Менеджер Юлия</div>
            <div className="jchat-bubble__text">{PROACTIVE_TEXT}</div>
          </div>
          <div className="jchat-bubble__arrow"></div>
        </div>
      )}

      {/* ── Chat window ── */}
      <div className={`jchat ${isOpen ? 'jchat--open' : ''}`}>

        {/* Header */}
        <div className="jchat__header">
          <div className="jchat__header-left">
            <div className="jchat__operator-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span className={`jchat__online-dot${connected ? '' : ' jchat__online-dot--off'}`}></span>
            </div>
            <div className="jchat__header-info">
              <div className="jchat__operator-name">{operatorName}</div>
              <div className="jchat__operator-dept">Отдел продаж</div>
              <div className="jchat__operator-status">
                <span className={`jchat__status-indicator${connected ? '' : ' jchat__status-indicator--off'}`}></span>
                {connected ? 'Онлайн' : 'Не в сети'}
              </div>
            </div>
          </div>
          <div className="jchat__header-actions">
            {messages.length > 2 && !ratedDone && (
              <button className="jchat__rate-toggle" onClick={() => setShowRating(s => !s)} title="Оценить диалог">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </button>
            )}
            <button className="jchat__close" onClick={handleClose} aria-label="Закрыть чат">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Rating panel */}
        {showRating && (
          <div className="jchat__rating">
            {ratedDone ? (
              <div className="jchat__rating-thanks">Спасибо за оценку! 🙏</div>
            ) : (
              <>
                <div className="jchat__rating-title">Оцените качество обслуживания</div>
                <div className="jchat__rating-stars">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button
                      key={v}
                      className={`jchat__star${v <= (ratingHover || ratingValue) ? ' jchat__star--active' : ''}`}
                      onClick={() => handleRate(v)}
                      onMouseEnter={() => setRatingHover(v)}
                      onMouseLeave={() => setRatingHover(0)}
                    >★</button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Pre-chat form ── */}
        {phase === 'prechat' ? (
          <div className="jchat__prechat">
            <div className="jchat__prechat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="52" height="52">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
              </svg>
            </div>
            <h3 className="jchat__prechat-title">Начните диалог</h3>
            <p className="jchat__prechat-subtitle">Представьтесь, чтобы мы могли связаться с вами</p>
            <form className="jchat__prechat-form" onSubmit={handlePrechatSubmit}>
              <input
                className="jchat__prechat-input"
                type="text"
                placeholder="Ваше имя *"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                autoFocus
              />
              <input
                className="jchat__prechat-input"
                type="tel"
                placeholder="+7 (___) ___-__-__ *"
                value={formPhone}
                onChange={handlePhoneChange}
                onKeyDown={handlePhoneKeyDown}
              />
              {formError && <div className="jchat__prechat-error">{formError}</div>}
              <button className="jchat__prechat-submit" type="submit">Начать чат</button>
            </form>
            <div className="jchat__prechat-privacy">
              Нажимая кнопку, вы соглашаетесь с&nbsp;обработкой персональных данных
            </div>
          </div>
        ) : (
          <>
            {/* ── Messages area ── */}
            <div className="jchat__messages">
              {messages.map((msg, i) => {
                const isOp = msg.from === 'operator';
                const showAvatar = isOp && (i === 0 || messages[i - 1].from !== 'operator');
                return (
                  <div key={msg.id} className={`jchat__msg ${isOp ? 'jchat__msg--operator' : 'jchat__msg--user'}`}>
                    {isOp && (
                      showAvatar ? (
                        <div className="jchat__msg-avatar">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                        </div>
                      ) : (
                        <div className="jchat__msg-avatar-spacer"></div>
                      )
                    )}
                    <div className="jchat__msg-content">
                      {showAvatar && isOp && (
                        <span className="jchat__msg-sender">{msg.senderName || operatorName}</span>
                      )}
                      <div className="jchat__msg-bubble">{msg.text}</div>
                      <span className="jchat__msg-time">{msg.time}</span>
                    </div>
                  </div>
                );
              })}

              {/* Quick replies */}
              {showQuickReplies && messages.length <= 1 && (
                <div className="jchat__quick-replies">
                  {QUICK_REPLIES.map((text, i) => (
                    <button key={i} className="jchat__quick-btn" onClick={() => handleQuickReply(text)}>
                      {text}
                    </button>
                  ))}
                </div>
              )}

              {/* Typing indicator */}
              {typing && (
                <div className="jchat__msg jchat__msg--operator">
                  <div className="jchat__msg-avatar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <div className="jchat__msg-content">
                    <div className="jchat__msg-bubble jchat__typing">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Input area ── */}
            <form className="jchat__input-area" onSubmit={handleSend}>
              <input
                type="text"
                className="jchat__input"
                placeholder="Напишите сообщение..."
                value={input}
                onChange={handleInputChange}
                autoComplete="off"
              />
              <button type="submit" className="jchat__send" disabled={!input.trim()} aria-label="Отправить">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </form>
          </>
        )}

        {/* Footer branding */}
        <div className="jchat__footer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
          </svg>
          <span>Titanium Drive</span>
        </div>
      </div>

      {/* ── FAB button ── */}
      <button
        className={`jchat__fab ${isOpen ? 'jchat__fab--hidden' : ''} ${!isOpen && !hasEngaged.current ? 'jchat__fab--pulse' : ''}`}
        onClick={handleOpen}
        aria-label="Открыть чат"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {unread > 0 && <span className="jchat__badge">{unread}</span>}
      </button>
    </>
  );
}
