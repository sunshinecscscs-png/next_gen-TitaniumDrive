import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { loginUser } from '../../api/auth.js';
import { fetchAdminStats, fetchAdminUsers, changeUserRole, deleteUser, checkHasAdmin, setupFirstAdmin, registerAdmin, createAdmin, fetchUserDetail, fetchAdminsList } from '../../api/admin.js';
import { fetchAdminCars, createCar, updateCar, deleteCar, toggleCarPublish, uploadCarImages } from '../../api/cars.js';
import { fetchCallbackRequests, fetchCallbackStats, updateCallbackStatus, deleteCallbackRequest, claimCallbackRequest } from '../../api/callbackRequests.js';
import { fetchChatRooms, fetchRoomMessages, markRoomRead, claimChatRoom } from '../../api/chat.js';
import './AdminPanel.css';

const TOKEN_KEY = 'autosite_token';

/* ══════════════════════ Login / Setup screen ══════════════════════ */
function AdminLogin({ onSuccess }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('loading'); // 'loading' | 'login' | 'setup' | 'register'
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkHasAdmin()
      .then(({ hasAdmin }) => setMode(hasAdmin ? 'login' : 'setup'))
      .catch(() => setMode('login'));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user, token } = await loginUser({ email, password });
      if (user.role !== 'admin') {
        setError('У этого аккаунта нет прав администратора');
        setLoading(false);
        return;
      }
      localStorage.setItem(TOKEN_KEY, token);
      onSuccess(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user, token } = await setupFirstAdmin({ name, email, password, nickname });
      localStorage.setItem(TOKEN_KEY, token);
      onSuccess(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user, token } = await registerAdmin({ name, email, password, nickname });
      localStorage.setItem(TOKEN_KEY, token);
      onSuccess(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'loading') {
    return <div className="admin-overlay" style={{ alignItems: 'center', justifyContent: 'center', color: '#888' }}>Загрузка...</div>;
  }

  return (
    <div className="admin-overlay">
      <div className="admin-login">
        <form className="admin-login__card" onSubmit={mode === 'setup' ? handleSetup : mode === 'register' ? handleRegister : handleLogin}>
          <div className="admin-login__title">
            {mode === 'setup' ? 'Создание администратора' : mode === 'register' ? 'Регистрация администратора' : 'Панель администратора'}
          </div>
          <div className="admin-login__subtitle">
            {mode === 'setup'
              ? 'Администраторов ещё нет. Создайте первого.'
              : mode === 'register'
                ? 'Заполните данные для создания аккаунта'
                : 'Войдите с учётной записью администратора'}
          </div>

          {(mode === 'setup' || mode === 'register') && (
            <>
              <label className="admin-login__label">Имя</label>
              <input
                className="admin-login__input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                autoFocus
              />
              <label className="admin-login__label">Ник (необязательно)</label>
              <input
                className="admin-login__input"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ник для отображения"
              />
            </>
          )}

          <label className="admin-login__label">Email</label>
          <input
            className="admin-login__input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@autosite.ru"
            autoFocus={mode === 'login'}
          />

          <label className="admin-login__label">Пароль</label>
          <input
            className="admin-login__input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {error && <div className="admin-login__error">{error}</div>}

          <button className="admin-login__btn" type="submit" disabled={loading || !email || !password || ((mode === 'setup' || mode === 'register') && !name)}>
            {loading
              ? (mode === 'login' ? 'Вход...' : 'Создание...')
              : (mode === 'setup' ? 'Создать администратора' : mode === 'register' ? 'Зарегистрироваться' : 'Войти')}
          </button>

          {mode === 'login' && (
            <button type="button" className="admin-login__toggle" onClick={() => { setError(''); setMode('register'); }}>
              Нет аккаунта? Зарегистрироваться
            </button>
          )}
          {mode === 'register' && (
            <button type="button" className="admin-login__toggle" onClick={() => { setError(''); setMode('login'); }}>
              Уже есть аккаунт? Войти
            </button>
          )}

          <button type="button" className="admin-login__back" onClick={() => navigate('/')}>
            ← Вернуться на сайт
          </button>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════ Car form defaults ══════════════════════ */
const CAR_FIELDS = [
  { key: 'brand', label: 'Марка', placeholder: 'Suzuki', required: true },
  { key: 'model', label: 'Модель', placeholder: 'Vitara GLX' },
  { key: 'year', label: 'Год', placeholder: '2025', type: 'number' },
  { key: 'spec', label: 'Спецификация', placeholder: '1.4 BOOSTERJET/103 KW 4x4 (6AT)' },
  { key: 'price', label: 'Цена (₽)', placeholder: '1 244 000', formatted: true, required: true },
  { key: 'mileage', label: 'Пробег (км)', placeholder: '25000', type: 'number' },
  { key: 'condition', label: 'Состояние', placeholder: 'Новое авто', select: ['Новое авто', 'С пробегом'] },
  { key: 'body_type', label: 'Кузов', placeholder: 'Кроссовер', select: ['Кроссовер', 'Седан', 'Хэтчбек', 'Лифтбек', 'Универсал', 'Минивэн', 'Купе', 'Пикап', 'Фургон'] },
  { key: 'fuel', label: 'Топливо', placeholder: 'Бензин', select: ['Бензин', 'Дизель', 'Гибрид', 'Электро', 'Газ'] },
  { key: 'drive', label: 'Привод', placeholder: 'Полный', select: ['Передний', 'Задний', 'Полный'] },
  { key: 'transmission', label: 'Коробка передач', placeholder: 'Автоматическая, 6 ст.' },
  { key: 'engine', label: 'Двигатель', placeholder: '1373 см³/1.4 л' },
  { key: 'power', label: 'Мощность', placeholder: '103кВт, 140 л.с.' },
  { key: 'color_name', label: 'Цвет (название)', placeholder: 'Серебряный металлик' },
  { key: 'color_hex', label: 'Цвет (HEX)', placeholder: '#c0c0c0' },
  { key: 'description', label: 'Описание', placeholder: 'Описание автомобиля...', textarea: true },
];

function defaultCarForm() {
  return {
    brand: '', model: '', year: '', spec: '',
    price: '', old_price: '', hasDiscount: false, mileage: '', condition: 'Новое авто',
    body_type: '', fuel: '', drive: '', transmission: '',
    engine: '', power: '',
    color_name: '', color_hex: '#cccccc',
    description: '', is_published: true,
    images: [],
  };
}

/* ══════════════════════ Dashboard ══════════════════════ */
function AdminDashboard({ admin }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('dashboard'); // 'dashboard' | 'users' | 'cars' | 'requests'
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersMeta, setUsersMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '', nickname: '' });
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  /* Cars state */
  const [cars, setCars] = useState([]);
  const [carsMeta, setCarsMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [carsSearch, setCarsSearch] = useState('');
  const [carsSearchDebounced, setCarsSearchDebounced] = useState('');
  const [carsLoading, setCarsLoading] = useState(false);
  const [showCarForm, setShowCarForm] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  const [carForm, setCarForm] = useState(defaultCarForm());
  const [carFormError, setCarFormError] = useState('');
  const [carFormLoading, setCarFormLoading] = useState(false);

  /* Requests state */
  const [requests, setRequests] = useState([]);
  const [requestsMeta, setRequestsMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [requestsSearch, setRequestsSearch] = useState('');
  const [requestsSearchDebounced, setRequestsSearchDebounced] = useState('');
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsFilterType, setRequestsFilterType] = useState('');
  const [requestsFilterStatus, setRequestsFilterStatus] = useState('');
  const [requestsFilterAdmin, setRequestsFilterAdmin] = useState('');
  const [requestsStats, setRequestsStats] = useState(null);
  const [viewRequest, setViewRequest] = useState(null);
  const [statusDropdownId, setStatusDropdownId] = useState(null);

  /* Admin list for filters */
  const [adminsList, setAdminsList] = useState([]);

  /* Chat state */
  const [chatRooms, setChatRooms] = useState([]);
  const [chatFilterAdmin, setChatFilterAdmin] = useState('');
  const [chatActiveRoom, setChatActiveRoom] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatTypingUser, setChatTypingUser] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const chatSocketRef = useRef(null);
  const chatMsgEndRef = useRef(null);
  const chatTypingTimerRef = useRef(null);
  const audioCtxRef = useRef(null);

  /* Notification toasts */
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  /* Notification feed (persistent history) */
  const [notifFeed, setNotifFeed] = useState([]);
  const [notifFeedOpen, setNotifFeedOpen] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const notifFeedRef = useRef(null);

  const addToast = useCallback((toast) => {
    const id = ++toastIdRef.current;
    const ts = Date.now();
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
    // Also add to persistent feed
    setNotifFeed(prev => [{ ...toast, id, ts, read: false }, ...prev].slice(0, 100));
    setNotifUnread(prev => prev + 1);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const markAllNotifRead = useCallback(() => {
    setNotifFeed(prev => prev.map(n => ({ ...n, read: true })));
    setNotifUnread(0);
  }, []);

  const clearNotifFeed = useCallback(() => {
    setNotifFeed([]);
    setNotifUnread(0);
  }, []);

  /* Close notification feed on outside click */
  useEffect(() => {
    if (!notifFeedOpen) return;
    const handler = (e) => {
      if (notifFeedRef.current && !notifFeedRef.current.contains(e.target)) {
        setNotifFeedOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifFeedOpen]);

  /* Notification sound — pleasant double-chime */
  const playNotificationSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      // Chime 1
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.connect(g1); g1.connect(ctx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(830, now);
      g1.gain.setValueAtTime(0.22, now);
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.start(now); osc1.stop(now + 0.35);
      // Chime 2 (higher, delayed)
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.connect(g2); g2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1245, now + 0.15);
      g2.gain.setValueAtTime(0, now);
      g2.gain.setValueAtTime(0.18, now + 0.15);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.start(now + 0.15); osc2.stop(now + 0.55);
    } catch { /* audio not available */ }
  }, []);

  /* Close dropdown on outside click */
  useEffect(() => {
    if (statusDropdownId === null) return;
    const handler = (e) => {
      if (!e.target.closest('.admin-status-dropdown-wrap')) setStatusDropdownId(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [statusDropdownId]);

  /* Load stats */
  useEffect(() => {
    fetchAdminStats().then(setStats).catch(() => {});
    fetchCallbackStats().then(setRequestsStats).catch(() => {});
  }, []);

  /* Debounce search */
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  /* Load users */
  const loadUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await fetchAdminUsers({ page, search: searchDebounced });
      setUsers(data.users);
      setUsersMeta({ total: data.total, page: data.page, pages: data.pages });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [searchDebounced]);

  useEffect(() => {
    if (tab === 'users') loadUsers(1);
  }, [tab, loadUsers]);

  /* Actions */
  const handleToggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Сменить роль ${user.email} на "${newRole}"?`)) return;
    try {
      await changeUserRole(user.id, newRole);
      loadUsers(usersMeta.page);
      fetchAdminStats().then(setStats);
    } catch (err) { alert(err.message); }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`Удалить пользователя ${user.email}? Это действие необратимо.`)) return;
    try {
      await deleteUser(user.id);
      loadUsers(usersMeta.page);
      fetchAdminStats().then(setStats);
    } catch (err) { alert(err.message); }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    navigate('/');
    window.location.reload();
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);
    try {
      await createAdmin(newAdmin);
      setShowCreateAdmin(false);
      setNewAdmin({ name: '', email: '', password: '', nickname: '' });
      loadUsers(usersMeta.page);
      fetchAdminStats().then(setStats);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  /* Debounce cars search */
  useEffect(() => {
    const t = setTimeout(() => setCarsSearchDebounced(carsSearch), 400);
    return () => clearTimeout(t);
  }, [carsSearch]);

  /* Load cars */
  const loadCars = useCallback(async (page = 1) => {
    setCarsLoading(true);
    try {
      const data = await fetchAdminCars({ page, search: carsSearchDebounced });
      setCars(data.cars);
      setCarsMeta({ total: data.total, page: data.page, pages: data.pages });
    } catch { /* ignore */ }
    finally { setCarsLoading(false); }
  }, [carsSearchDebounced]);

  useEffect(() => {
    if (tab === 'cars') loadCars(1);
  }, [tab, loadCars]);

  /* Car actions */
  const openNewCarForm = () => {
    setEditingCar(null);
    setCarForm(defaultCarForm());
    setCarFormError('');
    setShowCarForm(true);
  };

  const openEditCarForm = (car) => {
    setEditingCar(car);
    const existingImages = Array.isArray(car.images) ? car.images : [];
    setCarForm({
      brand: car.brand || '',
      model: car.model || '',
      year: car.year || '',
      spec: car.spec || '',
      price: car.price || '',
      old_price: car.old_price || '',
      hasDiscount: !!car.old_price,
      mileage: car.mileage || '',
      condition: car.condition || 'Новое авто',
      body_type: car.body_type || '',
      fuel: car.fuel || '',
      drive: car.drive || '',
      transmission: car.transmission || '',
      engine: car.engine || '',
      power: car.power || '',
      color_name: car.color_name || '',
      color_hex: car.color_hex || '#cccccc',
      description: car.description || '',
      is_published: car.is_published !== false,
      images: existingImages,
    });
    setCarFormError('');
    setShowCarForm(true);
  };

  const handleCarFormSubmit = async (e) => {
    e.preventDefault();
    setCarFormError('');
    setCarFormLoading(true);
    try {
      // Auto-set image/image2 from images array for backward compat
      // Auto-generate name from brand + model + year
      const autoName = [carForm.brand, carForm.model, carForm.year].filter(Boolean).join(' ');
      const payload = {
        ...carForm,
        name: autoName || 'Без названия',
        old_price: carForm.hasDiscount ? carForm.old_price : null,
        image: carForm.images[0] || null,
        image2: carForm.images[1] || null,
      };
      delete payload.hasDiscount;
      if (editingCar) {
        await updateCar(editingCar.id, payload);
      } else {
        await createCar(payload);
      }
      setShowCarForm(false);
      loadCars(carsMeta.page);
      fetchAdminStats().then(setStats);
    } catch (err) {
      setCarFormError(err.message);
    } finally {
      setCarFormLoading(false);
    }
  };

  const handleDeleteCar = async (car) => {
    if (!confirm(`Удалить "${car.brand || ''} ${car.model || ''} ${car.year || ''}"? Это действие необратимо.`.trim())) return;
    try {
      await deleteCar(car.id);
      loadCars(carsMeta.page);
      fetchAdminStats().then(setStats);
    } catch (err) { alert(err.message); }
  };

  const handleTogglePublish = async (car) => {
    try {
      await toggleCarPublish(car.id);
      loadCars(carsMeta.page);
    } catch (err) { alert(err.message); }
  };

  /* ── Image upload & drag-reorder ── */
  const [uploadingImages, setUploadingImages] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const fileInputRef = useCallback((node) => {
    if (node) node.setAttribute('accept', 'image/*');
  }, []);

  const handleImageFiles = async (files) => {
    const remaining = 30 - (carForm.images?.length || 0);
    if (remaining <= 0) { alert('Максимум 30 фотографий'); return; }
    const toUpload = Array.from(files).slice(0, remaining);
    if (!toUpload.length) return;

    setUploadingImages(true);
    try {
      const { urls } = await uploadCarImages(toUpload);
      setCarForm((prev) => ({ ...prev, images: [...(prev.images || []), ...urls] }));
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingImages(false);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('admin-upload--dragover');
    if (e.dataTransfer.files?.length) {
      handleImageFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files?.length) {
      handleImageFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeImage = (idx) => {
    setCarForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  };

  /* Drag to reorder */
  const handleDragStart = (idx) => setDragIdx(idx);

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setCarForm((prev) => {
      const imgs = [...prev.images];
      const [moved] = imgs.splice(dragIdx, 1);
      imgs.splice(idx, 0, moved);
      return { ...prev, images: imgs };
    });
    setDragIdx(idx);
  };

  const handleDragEnd = () => setDragIdx(null);

  /* ── Requests tab logic ── */
  useEffect(() => {
    const t = setTimeout(() => setRequestsSearchDebounced(requestsSearch), 400);
    return () => clearTimeout(t);
  }, [requestsSearch]);

  const loadRequests = useCallback(async (page = 1) => {
    setRequestsLoading(true);
    try {
      const data = await fetchCallbackRequests({
        page,
        limit: 20,
        type: requestsFilterType || undefined,
        status: requestsFilterStatus || undefined,
        search: requestsSearchDebounced || undefined,
        claimed_by: requestsFilterAdmin || undefined,
      });
      setRequests(data.requests);
      setRequestsMeta({ total: data.total, page: data.page, pages: data.pages });
    } catch { /* ignore */ }
    finally { setRequestsLoading(false); }
  }, [requestsSearchDebounced, requestsFilterType, requestsFilterStatus, requestsFilterAdmin]);

  useEffect(() => {
    if (tab === 'requests') {
      loadRequests(1);
      fetchCallbackStats().then(setRequestsStats).catch(() => {});
    }
  }, [tab, loadRequests]);

  /* ── Load admins list for filter dropdowns ── */
  useEffect(() => {
    fetchAdminsList().then(data => setAdminsList(data.admins || [])).catch(() => {});
  }, []);

  /* ── Chat: load rooms list ── */
  const loadChatRooms = useCallback(async () => {
    try {
      const data = await fetchChatRooms();
      setChatRooms(data.rooms || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadChatRooms();
  }, [loadChatRooms]);

  /* ── Refs for stable socket callbacks ── */
  const loadRequestsRef = useRef(loadRequests);
  const loadChatRoomsRef = useRef(loadChatRooms);
  const requestsMetaRef = useRef(requestsMeta);
  useEffect(() => { loadRequestsRef.current = loadRequests; }, [loadRequests]);
  useEffect(() => { loadChatRoomsRef.current = loadChatRooms; }, [loadChatRooms]);
  useEffect(() => { requestsMetaRef.current = requestsMeta; }, [requestsMeta]);

  /* ── Chat: Socket.IO for admin (always-on) ── */
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    chatSocketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Admin Socket] connected, id:', socket.id);
      setSocketConnected(true);
    });
    socket.on('disconnect', (reason) => {
      console.warn('[Admin Socket] disconnected:', reason);
      setSocketConnected(false);
    });
    socket.on('connect_error', (err) => {
      console.error('[Admin Socket] connect_error:', err.message);
      setSocketConnected(false);
    });

    socket.on('chat:message', (msg) => {
      // Update room list
      loadChatRoomsRef.current();
      // If viewing this room, append message
      setChatActiveRoom(prev => {
        if (prev && msg.room_id === prev.id) {
          setChatMessages(msgs => {
            if (msgs.some(m => m.id === msg.id)) return msgs;
            return [...msgs, msg];
          });
          if (msg.sender_id !== admin.id) {
            markRoomRead(prev.id).catch(() => {});
          }
        }
        return prev;
      });
      // Notification for user messages (not admin's own)
      if (!msg.is_admin_reply && msg.sender_id !== admin.id) {
        playNotificationSound();
        addToast({
          type: 'chat',
          title: 'Новое сообщение',
          message: msg.text?.length > 60 ? msg.text.slice(0, 60) + '...' : msg.text,
          senderName: msg.sender_name || 'Клиент',
          roomId: msg.room_id,
        });
      }
    });

    socket.on('admin:new-request', (request) => {
      playNotificationSound();
      const typeLabels = { simple: 'Обратный звонок', car: 'По автомобилю', question: 'Вопрос', order: 'Заказ' };
      addToast({
        type: 'request',
        title: 'Новая заявка',
        message: `${typeLabels[request.type] || request.type} от ${request.name}`,
        phone: request.phone,
      });
      // Refresh requests if on that tab
      loadRequestsRef.current(requestsMetaRef.current.page);
      fetchCallbackStats().then(setRequestsStats).catch(() => {});
    });

    socket.on('chat:typing', ({ userId, roomId }) => {
      setChatActiveRoom(prev => {
        if (prev && prev.id === roomId && userId !== admin.id) {
          setChatTypingUser(true);
          clearTimeout(chatTypingTimerRef.current);
          chatTypingTimerRef.current = setTimeout(() => setChatTypingUser(false), 2000);
        }
        return prev;
      });
    });

    socket.on('chat:read', () => { loadChatRoomsRef.current(); });

    return () => {
      socket.disconnect();
      chatSocketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin.id]);

  /* ── Chat: scroll to bottom ── */
  useEffect(() => {
    chatMsgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  /* ── Chat: select a room ── */
  const handleSelectChatRoom = async (room) => {
    setChatActiveRoom(room);
    setChatMessages([]);
    setChatTypingUser(false);
    try {
      const data = await fetchRoomMessages(room.id);
      setChatMessages(data.messages || []);
      if (Number(room.unread_count) > 0) {
        await markRoomRead(room.id);
        loadChatRooms();
      }
      // join room via socket
      if (chatSocketRef.current) chatSocketRef.current.emit('chat:join', { roomId: room.id });
    } catch { /* ignore */ }
  };

  /* ── Chat: send message (requires claim) ── */
  const handleChatSend = (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !chatSocketRef.current || !chatActiveRoom) return;
    if (!chatActiveRoom.claimed_by) {
      alert('Сначала нужно взять чат на себя');
      return;
    }
    chatSocketRef.current.emit('chat:send', { roomId: chatActiveRoom.id, text, asAdmin: true });
    setChatInput('');
  };

  /* ── Chat: typing ── */
  const handleChatInputChange = (e) => {
    setChatInput(e.target.value);
    if (chatSocketRef.current && chatActiveRoom) {
      chatSocketRef.current.emit('chat:typing', { roomId: chatActiveRoom.id });
    }
  };

  const handleChangeRequestStatus = async (req, newStatus) => {
    if (!req.claimed_by) {
      alert('Сначала нужно взять заявку на себя');
      return;
    }
    try {
      await updateCallbackStatus(req.id, newStatus);
      loadRequests(requestsMeta.page);
      fetchCallbackStats().then(setRequestsStats).catch(() => {});
    } catch (err) {
      alert(err.message);
    }
  };

  /* ── Claim request ── */
  const handleClaimRequest = async (req) => {
    try {
      const { request } = await claimCallbackRequest(req.id);
      loadRequests(requestsMeta.page);
      if (viewRequest && viewRequest.id === req.id) {
        setViewRequest({ ...viewRequest, claimed_by: request.claimed_by, claimed_at: request.claimed_at, claimed_by_name: request.claimed_by_name });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  /* ── Claim chat room ── */
  const handleClaimChatRoom = async (room) => {
    try {
      const { room: updated } = await claimChatRoom(room.id);
      setChatActiveRoom(prev => prev && prev.id === room.id
        ? { ...prev, claimed_by: updated.claimed_by, claimed_at: updated.claimed_at, claimed_by_name: updated.claimed_by_name }
        : prev
      );
      loadChatRooms();
    } catch (err) {
      alert(err.message);
    }
  };

  /* ── Toast click handlers ── */
  const handleToastClick = useCallback((toast) => {
    if (toast.type === 'chat') {
      setTab('chat');
      const room = chatRooms.find(r => r.id === toast.roomId);
      if (room) handleSelectChatRoom(room);
    } else if (toast.type === 'request') {
      setTab('requests');
    }
    removeToast(toast.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatRooms, removeToast]);

  const handleDeleteRequest = async (req) => {
    if (!confirm(`Удалить заявку #${req.id} от ${req.name}?`)) return;
    try {
      await deleteCallbackRequest(req.id);
      loadRequests(requestsMeta.page);
      fetchCallbackStats().then(setRequestsStats).catch(() => {});
    } catch (err) {
      alert(err.message);
    }
  };

  const typeLabel = (type) => {
    if (type === 'simple') return 'Обратный звонок';
    if (type === 'car') return 'По автомобилю';
    if (type === 'question') return 'Вопрос';
    if (type === 'order') return 'Заказ';
    return type;
  };

  const statusLabel = (status) => {
    if (status === 'new') return 'Новая';
    if (status === 'processed') return 'В работе';
    if (status === 'closed') return 'Закрыта';
    return status;
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDateTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleViewUser = async (userId) => {
    setViewLoading(true);
    try {
      const { user } = await fetchUserDetail(userId);
      setViewUser(user);
    } catch (err) {
      alert(err.message);
    } finally {
      setViewLoading(false);
    }
  };

  const genderLabel = (g) => {
    if (g === 'male') return 'Мужской';
    if (g === 'female') return 'Женский';
    return g || '—';
  };

  return (
    <div className="admin-overlay">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar__logo">
          AutoSite <span>ADMIN</span>
        </div>
        <nav className="admin-sidebar__nav">
          <button className={`admin-sidebar__item ${tab === 'dashboard' ? 'admin-sidebar__item--active' : ''}`} onClick={() => setTab('dashboard')}> 
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>Дашборд</span>
          </button>
          <button className={`admin-sidebar__item ${tab === 'users' ? 'admin-sidebar__item--active' : ''}`} onClick={() => setTab('users')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            <span>Пользователи</span>
          </button>
          <button className={`admin-sidebar__item ${tab === 'cars' ? 'admin-sidebar__item--active' : ''}`} onClick={() => setTab('cars')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17l-1 2M19 17l1 2"/><circle cx="7.5" cy="14.5" r="1.5"/><circle cx="16.5" cy="14.5" r="1.5"/></svg>
            <span>Автомобили</span>
          </button>
          <button className={`admin-sidebar__item ${tab === 'requests' ? 'admin-sidebar__item--active' : ''}`} onClick={() => setTab('requests')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            <span>Заявки</span>
          </button>
          <button className={`admin-sidebar__item ${tab === 'chat' ? 'admin-sidebar__item--active' : ''}`} onClick={() => setTab('chat')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
            <span>Чаты</span>
            {chatRooms.reduce((s, r) => s + (Number(r.unread_count) || 0), 0) > 0 && (
              <span className="admin-sidebar__badge">{chatRooms.reduce((s, r) => s + (Number(r.unread_count) || 0), 0)}</span>
            )}
          </button>
        </nav>
        <div className="admin-sidebar__footer">
          <button className="admin-sidebar__exit" onClick={handleLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Выйти
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="admin-main">
        <div className="admin-main__header">
          <h1 className="admin-main__title">
            {tab === 'dashboard' ? 'Дашборд' : tab === 'users' ? 'Пользователи' : tab === 'cars' ? 'Автомобили' : tab === 'chat' ? 'Чаты с клиентами' : 'Заявки на звонок'}
          </h1>
          <div className="admin-main__user">
            {/* Notification bell */}
            <div className="admin-notif-bell-wrap" ref={notifFeedRef}>
              <button
                className={`admin-notif-bell ${notifUnread > 0 ? 'admin-notif-bell--has' : ''}`}
                onClick={() => { setNotifFeedOpen(v => !v); if (!notifFeedOpen) markAllNotifRead(); }}
                title="Уведомления"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                {notifUnread > 0 && <span className="admin-notif-bell__badge">{notifUnread > 99 ? '99+' : notifUnread}</span>}
              </button>

              {/* Notification feed dropdown */}
              {notifFeedOpen && (
                <div className="admin-notif-feed">
                  <div className="admin-notif-feed__header">
                    <span className="admin-notif-feed__title">Уведомления</span>
                    {notifFeed.length > 0 && (
                      <button className="admin-notif-feed__clear" onClick={clearNotifFeed}>Очистить</button>
                    )}
                  </div>
                  <div className="admin-notif-feed__list">
                    {notifFeed.length === 0 ? (
                      <div className="admin-notif-feed__empty">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                        <span>Нет уведомлений</span>
                      </div>
                    ) : (
                      notifFeed.map((n) => (
                        <div
                          key={n.id}
                          className={`admin-notif-feed__item admin-notif-feed__item--${n.type} ${!n.read ? 'admin-notif-feed__item--unread' : ''}`}
                          onClick={() => { handleToastClick(n); setNotifFeedOpen(false); }}
                        >
                          <div className="admin-notif-feed__item-icon">
                            {n.type === 'chat' ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                            )}
                          </div>
                          <div className="admin-notif-feed__item-body">
                            <div className="admin-notif-feed__item-title">{n.title}</div>
                            <div className="admin-notif-feed__item-text">
                              {n.senderName && <strong>{n.senderName}: </strong>}
                              {n.message}
                            </div>
                            {n.phone && <div className="admin-notif-feed__item-phone">{n.phone}</div>}
                          </div>
                          <div className="admin-notif-feed__item-time">
                            {new Date(n.ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <span>{admin.email}</span>
            <span
              className={`admin-socket-status ${socketConnected ? 'admin-socket-status--ok' : 'admin-socket-status--off'}`}
              title={socketConnected ? 'Соединение с сервером активно' : 'Нет соединения с сервером (уведомления не работают)'}
            >{socketConnected ? '●' : '○'}</span>
            <div className="admin-main__user-avatar">
              {(admin.name?.[0] || 'A').toUpperCase()}
            </div>
          </div>
        </div>

        {/* Dashboard tab */}
        {tab === 'dashboard' && stats && (
          <div className="admin-stats">
            <div className="admin-stat-card">
              <span className="admin-stat-card__value">{stats.totalUsers}</span>
              <span className="admin-stat-card__label">Всего пользователей</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-card__value">{stats.totalAdmins}</span>
              <span className="admin-stat-card__label">Администраторов</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-card__value">{stats.registeredToday}</span>
              <span className="admin-stat-card__label">Зарегистрировано сегодня</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-card__value">{stats.totalCars ?? 0}</span>
              <span className="admin-stat-card__label">Всего автомобилей</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-card__value">{stats.publishedCars ?? 0}</span>
              <span className="admin-stat-card__label">Опубликовано</span>
            </div>
            <div className="admin-stat-card" style={{ cursor: 'pointer' }} onClick={() => setTab('requests')}>
              <span className="admin-stat-card__value" style={requestsStats?.new_count ? { color: '#ff6b6b' } : {}}>{requestsStats?.new_count ?? 0}</span>
              <span className="admin-stat-card__label">Новых заявок</span>
            </div>
            <div className="admin-stat-card" style={{ cursor: 'pointer' }} onClick={() => setTab('requests')}>
              <span className="admin-stat-card__value">{requestsStats?.total ?? 0}</span>
              <span className="admin-stat-card__label">Всего заявок</span>
            </div>
          </div>
        )}

        {tab === 'dashboard' && !stats && (
          <p style={{ color: '#888' }}>Загрузка статистики...</p>
        )}

        {/* Users tab */}
        {tab === 'users' && (
          <div className="admin-table-wrap">
            <div className="admin-table-toolbar">
              <input
                className="admin-table-toolbar__search"
                placeholder="Поиск по имени, email, телефону..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="admin-table__btn" style={{ padding: '10px 16px', whiteSpace: 'nowrap' }} onClick={() => setShowCreateAdmin(true)}>
                + Добавить админа
              </button>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Имя</th>
                  <th>Email</th>
                  <th>Телефон</th>
                  <th>Роль</th>
                  <th>Дата рег.</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', color: '#888', padding: '32px' }}>Загрузка...</td></tr>
                )}
                {!loading && users.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', color: '#888', padding: '32px' }}>Пользователи не найдены</td></tr>
                )}
                {!loading && users.map((u) => (
                  <tr key={u.id}>
                    <td>#{u.id}</td>
                    <td>{[u.surname, u.name].filter(Boolean).join(' ') || '—'}</td>
                    <td>{u.email}</td>
                    <td>{u.phone || '—'}</td>
                    <td>
                      <span className={`admin-table__role admin-table__role--${u.role}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>{formatDate(u.created_at)}</td>
                    <td>
                      <div className="admin-table__actions">
                        <button className="admin-table__btn admin-table__btn--view" onClick={() => handleViewUser(u.id)} title="Подробнее">
                          👁
                        </button>
                        <button className="admin-table__btn" onClick={() => handleToggleRole(u)} title={u.role === 'admin' ? 'Сделать User' : 'Сделать Admin'}>
                          {u.role === 'admin' ? '↓ User' : '↑ Admin'}
                        </button>
                        <button className="admin-table__btn admin-table__btn--danger" onClick={() => handleDeleteUser(u)} title="Удалить">
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {usersMeta.pages > 1 && (
              <div className="admin-pagination">
                <button className="admin-pagination__btn" disabled={usersMeta.page <= 1} onClick={() => loadUsers(usersMeta.page - 1)}>←</button>
                {Array.from({ length: usersMeta.pages }, (_, i) => i + 1).map((p) => (
                  <button key={p} className={`admin-pagination__btn ${p === usersMeta.page ? 'admin-pagination__btn--active' : ''}`} onClick={() => loadUsers(p)}>{p}</button>
                ))}
                <button className="admin-pagination__btn" disabled={usersMeta.page >= usersMeta.pages} onClick={() => loadUsers(usersMeta.page + 1)}>→</button>
                <span className="admin-pagination__info">Всего: {usersMeta.total}</span>
              </div>
            )}
          </div>
        )}

        {/* Cars tab */}
        {tab === 'cars' && (
          <div className="admin-table-wrap">
            <div className="admin-table-toolbar">
              <input
                className="admin-table-toolbar__search"
                placeholder="Поиск по названию, марке, модели..."
                value={carsSearch}
                onChange={(e) => setCarsSearch(e.target.value)}
              />
              <button className="admin-table__btn" style={{ padding: '10px 16px', whiteSpace: 'nowrap' }} onClick={openNewCarForm}>
                + Добавить авто
              </button>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Фото</th>
                  <th>Название</th>
                  <th>Марка</th>
                  <th>Цена</th>
                  <th>Год</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {carsLoading && (
                  <tr><td colSpan="8" style={{ textAlign: 'center', color: '#888', padding: '32px' }}>Загрузка...</td></tr>
                )}
                {!carsLoading && cars.length === 0 && (
                  <tr><td colSpan="8" style={{ textAlign: 'center', color: '#888', padding: '32px' }}>Автомобили не найдены</td></tr>
                )}
                {!carsLoading && cars.map((c) => (
                  <tr key={c.id}>
                    <td>#{c.id}</td>
                    <td>
                      {c.image ? (
                        <img src={c.image} alt="" className="admin-car-thumb" />
                      ) : (
                        <div className="admin-car-thumb admin-car-thumb--empty">🚗</div>
                      )}
                    </td>
                    <td>
                      <div className="admin-car-name">{c.name}</div>
                      {c.spec && <div className="admin-car-spec">{c.spec}</div>}
                    </td>
                    <td>{c.brand || '—'}</td>
                    <td className="admin-car-price">
                      {Number(c.price).toLocaleString('ru-RU')} ₽
                      {c.old_price && <span className="admin-car-price--old">{Number(c.old_price).toLocaleString('ru-RU')} ₽</span>}
                    </td>
                    <td>{c.year || '—'}</td>
                    <td>
                      <span className={`admin-table__role ${c.is_published ? 'admin-table__role--admin' : 'admin-table__role--user'}`} style={{ cursor: 'pointer' }} onClick={() => handleTogglePublish(c)} title="Переключить">
                        {c.is_published ? 'Опублик.' : 'Скрыто'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-table__actions">
                        <button className="admin-table__btn" onClick={() => openEditCarForm(c)} title="Редактировать">
                          ✎
                        </button>
                        <button className="admin-table__btn admin-table__btn--danger" onClick={() => handleDeleteCar(c)} title="Удалить">
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {carsMeta.pages > 1 && (
              <div className="admin-pagination">
                <button className="admin-pagination__btn" disabled={carsMeta.page <= 1} onClick={() => loadCars(carsMeta.page - 1)}>←</button>
                {Array.from({ length: carsMeta.pages }, (_, i) => i + 1).map((p) => (
                  <button key={p} className={`admin-pagination__btn ${p === carsMeta.page ? 'admin-pagination__btn--active' : ''}`} onClick={() => loadCars(p)}>{p}</button>
                ))}
                <button className="admin-pagination__btn" disabled={carsMeta.page >= carsMeta.pages} onClick={() => loadCars(carsMeta.page + 1)}>→</button>
                <span className="admin-pagination__info">Всего: {carsMeta.total}</span>
              </div>
            )}
          </div>
        )}

        {/* Requests tab */}
        {tab === 'requests' && (
          <div className="admin-table-wrap">
            {/* Stats mini-cards */}
            {requestsStats && (
              <div className="admin-requests-stats">
                <div className="admin-requests-stat">
                  <span className="admin-requests-stat__value" style={{ color: '#ff6b6b' }}>{requestsStats.new_count}</span>
                  <span className="admin-requests-stat__label">Новые</span>
                </div>
                <div className="admin-requests-stat">
                  <span className="admin-requests-stat__value" style={{ color: '#ffd43b' }}>{requestsStats.processed_count}</span>
                  <span className="admin-requests-stat__label">В работе</span>
                </div>
                <div className="admin-requests-stat">
                  <span className="admin-requests-stat__value" style={{ color: '#51cf66' }}>{requestsStats.closed_count}</span>
                  <span className="admin-requests-stat__label">Закрыты</span>
                </div>
                <div className="admin-requests-stat">
                  <span className="admin-requests-stat__value">{requestsStats.simple_count}</span>
                  <span className="admin-requests-stat__label">Обратные звонки</span>
                </div>
                <div className="admin-requests-stat">
                  <span className="admin-requests-stat__value">{requestsStats.car_count}</span>
                  <span className="admin-requests-stat__label">По авто</span>
                </div>
                <div className="admin-requests-stat">
                  <span className="admin-requests-stat__value">{requestsStats.question_count}</span>
                  <span className="admin-requests-stat__label">Вопросы</span>
                </div>
              </div>
            )}

            <div className="admin-table-toolbar">
              <input
                className="admin-table-toolbar__search"
                placeholder="Поиск по имени, телефону, авто..."
                value={requestsSearch}
                onChange={(e) => setRequestsSearch(e.target.value)}
              />
              <select className="admin-requests-filter" value={requestsFilterType} onChange={(e) => setRequestsFilterType(e.target.value)}>
                <option value="">Все типы</option>
                <option value="simple">Обратный звонок</option>
                <option value="car">По автомобилю</option>
                <option value="question">Вопрос</option>
                <option value="order">Заказ</option>
              </select>
              <select className="admin-requests-filter" value={requestsFilterStatus} onChange={(e) => setRequestsFilterStatus(e.target.value)}>
                <option value="">Все статусы</option>
                <option value="new">Новые</option>
                <option value="processed">В работе</option>
                <option value="closed">Закрыты</option>
              </select>
              <select className="admin-requests-filter" value={requestsFilterAdmin} onChange={(e) => setRequestsFilterAdmin(e.target.value)}>
                <option value="">Все ответственные</option>
                {adminsList.map(a => (
                  <option key={a.id} value={a.id}>{a.nickname || a.name || a.email}</option>
                ))}
              </select>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Тип</th>
                  <th>Имя</th>
                  <th>Телефон</th>
                  <th>Детали</th>
                  <th>Ответственный</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {requestsLoading && (
                  <tr><td colSpan="9" style={{ textAlign: 'center', color: '#888', padding: '32px' }}>Загрузка...</td></tr>
                )}
                {!requestsLoading && requests.length === 0 && (
                  <tr><td colSpan="9" style={{ textAlign: 'center', color: '#888', padding: '32px' }}>Заявки не найдены</td></tr>
                )}
                {!requestsLoading && requests.map((r) => (
                  <tr key={r.id} style={r.status === 'new' ? { background: 'rgba(255,107,107,0.06)' } : {}}>
                    <td>#{r.id}</td>
                    <td>
                      <span className={`admin-request-type admin-request-type--${r.type}`}>
                        {typeLabel(r.type)}
                      </span>
                    </td>
                    <td>{r.name}</td>
                    <td><a href={`tel:${r.phone}`} style={{ color: '#4f8cff', textDecoration: 'none' }}>{r.phone}</a></td>
                    <td className="admin-request-details">
                      {(r.type === 'car' || r.type === 'order') && r.car_name && (
                        <span title="Автомобиль">
                          🚗{' '}
                          {r.car_id ? (
                            <a href={`/catalog/${r.car_id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#4f8cff', textDecoration: 'none' }}>
                              {r.car_name}
                            </a>
                          ) : r.car_name}
                        </span>
                      )}
                      {r.type === 'question' && r.topic && <span title="Тема">📋 {r.topic}</span>}
                      {r.type === 'question' && r.message && <span title="Сообщение" className="admin-request-message">{r.message.length > 50 ? r.message.slice(0, 50) + '...' : r.message}</span>}
                      {r.email && <span title="Email">✉ {r.email}</span>}
                      {r.type !== 'car' && r.type !== 'order' && r.type !== 'question' && !r.email && '—'}
                    </td>
                    <td>
                      {r.claimed_by ? (
                        <span className="admin-claim-badge admin-claim-badge--claimed">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          {r.claimed_by_name || r.claimed_by_email || 'Админ'}
                        </span>
                      ) : (
                        <button className="admin-claim-btn admin-claim-btn--sm" onClick={() => handleClaimRequest(r)}>
                          Взять
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="admin-status-dropdown-wrap">
                        <span
                          className={`admin-request-status admin-request-status--${r.status}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setStatusDropdownId(statusDropdownId === r.id ? null : r.id)}
                          title="Нажмите для смены статуса"
                        >
                          {statusLabel(r.status)} ▾
                        </span>
                        {statusDropdownId === r.id && (
                          <div className="admin-status-dropdown">
                            {['new', 'processed', 'closed'].map((s) => (
                              <button
                                key={s}
                                className={`admin-status-dropdown__item admin-status-dropdown__item--${s}${r.status === s ? ' admin-status-dropdown__item--active' : ''}`}
                                onClick={() => {
                                  if (r.status !== s) handleChangeRequestStatus(r, s);
                                  setStatusDropdownId(null);
                                }}
                              >
                                <span className={`admin-status-dropdown__dot admin-status-dropdown__dot--${s}`} />
                                {r.type === 'order'
                                  ? { new: 'Новый', processed: 'В обработке', closed: 'Завершён' }[s]
                                  : { new: 'Новая', processed: 'В работе', closed: 'Закрыта' }[s]
                                }
                                {r.status === s && ' ✓'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{formatDateTime(r.created_at)}</td>
                    <td>
                      <div className="admin-table__actions">
                        <button className="admin-table__btn" onClick={() => setViewRequest(r)} title="Подробнее">
                          👁
                        </button>
                        <button className="admin-table__btn admin-table__btn--danger" onClick={() => handleDeleteRequest(r)} title="Удалить">
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {requestsMeta.pages > 1 && (
              <div className="admin-pagination">
                <button className="admin-pagination__btn" disabled={requestsMeta.page <= 1} onClick={() => loadRequests(requestsMeta.page - 1)}>←</button>
                {Array.from({ length: requestsMeta.pages }, (_, i) => i + 1).map((p) => (
                  <button key={p} className={`admin-pagination__btn ${p === requestsMeta.page ? 'admin-pagination__btn--active' : ''}`} onClick={() => loadRequests(p)}>{p}</button>
                ))}
                <button className="admin-pagination__btn" disabled={requestsMeta.page >= requestsMeta.pages} onClick={() => loadRequests(requestsMeta.page + 1)}>→</button>
                <span className="admin-pagination__info">Всего: {requestsMeta.total}</span>
              </div>
            )}
          </div>
        )}

        {/* Chat tab */}
        {tab === 'chat' && (
          <div className="admin-chat">
            {/* Room list */}
            <div className="admin-chat__rooms">
              <div className="admin-chat__rooms-header">Диалоги</div>
              <div style={{ padding: '0 12px 8px' }}>
                <select
                  className="admin-requests-filter"
                  style={{ width: '100%', fontSize: 13 }}
                  value={chatFilterAdmin}
                  onChange={(e) => setChatFilterAdmin(e.target.value)}
                >
                  <option value="">Все ответственные</option>
                  {adminsList.map(a => (
                    <option key={a.id} value={String(a.id)}>{a.nickname || a.name || a.email}</option>
                  ))}
                </select>
              </div>
              {chatRooms.filter(room => !chatFilterAdmin || String(room.claimed_by) === chatFilterAdmin).length === 0 && (
                <div className="admin-chat__empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                  <p>{chatFilterAdmin ? 'Нет чатов для выбранного админа' : 'Нет активных чатов'}</p>
                  <span style={{ fontSize: 12, color: '#555' }}>Чаты появятся когда клиенты напишут</span>
                </div>
              )}
              {chatRooms.filter(room => !chatFilterAdmin || String(room.claimed_by) === chatFilterAdmin).map(room => (
                <div
                  key={room.id}
                  className={`admin-chat__room ${chatActiveRoom?.id === room.id ? 'admin-chat__room--active' : ''}`}
                  onClick={() => handleSelectChatRoom(room)}
                >
                  <div className="admin-chat__room-avatar">
                    {(room.user_name?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="admin-chat__room-info">
                    <div className="admin-chat__room-name">
                      {room.user_name || room.user_email}
                      {Number(room.unread_count) > 0 && <span className="admin-chat__room-badge">{room.unread_count}</span>}
                    </div>
                    <div className="admin-chat__room-last">
                      {room.claimed_by_name && <span style={{ color: '#51cf66', fontSize: 11 }}>● {room.claimed_by_name} · </span>}
                      {room.last_message || 'Нет сообщений'}
                    </div>
                  </div>
                  {room.updated_at && (
                    <div className="admin-chat__room-time">
                      {new Date(room.updated_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Messages area */}
            <div className="admin-chat__conversation">
              {!chatActiveRoom ? (
                <div className="admin-chat__no-room">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                  <p>Выберите чат из списка слева</p>
                </div>
              ) : (
                <>
                  <div className="admin-chat__conv-header">
                    <div>
                      <strong>{chatActiveRoom.user_name || chatActiveRoom.user_email}</strong>
                      <span>{chatActiveRoom.user_email}</span>
                    </div>
                    {chatActiveRoom.claimed_by ? (
                      <span className="admin-claim-badge admin-claim-badge--claimed">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {chatActiveRoom.claimed_by_name || 'Админ'}
                      </span>
                    ) : (
                      <button className="admin-claim-btn" onClick={() => handleClaimChatRoom(chatActiveRoom)}>
                        Взять на себя
                      </button>
                    )}
                  </div>
                  <div className="admin-chat__messages">
                    {chatMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`admin-chat__msg ${msg.is_admin_reply ? 'admin-chat__msg--admin' : 'admin-chat__msg--user'}`}
                      >
                        <div className="admin-chat__msg-bubble">{msg.text}</div>
                        <span className="admin-chat__msg-time">
                          {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                    {chatTypingUser && (
                      <div className="admin-chat__msg admin-chat__msg--user">
                        <div className="admin-chat__msg-bubble admin-chat__msg-typing">
                          <span></span><span></span><span></span>
                        </div>
                      </div>
                    )}
                    <div ref={chatMsgEndRef} />
                  </div>
                  {chatActiveRoom.claimed_by ? (
                    <form className="admin-chat__input-area" onSubmit={handleChatSend}>
                      <input
                        className="admin-chat__input"
                        type="text"
                        placeholder="Напишите ответ..."
                        value={chatInput}
                        onChange={handleChatInputChange}
                      />
                      <button className="admin-chat__send" type="submit" disabled={!chatInput.trim()}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </form>
                  ) : (
                    <div className="admin-chat__claim-bar">
                      <span>Чтобы ответить, нужно взять чат на себя</span>
                      <button className="admin-claim-btn" onClick={() => handleClaimChatRoom(chatActiveRoom)}>
                        Взять на себя
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
      {viewUser && (
        <div className="admin-modal-overlay" onClick={() => setViewUser(null)}>
          <div className="admin-user-detail" onClick={(e) => e.stopPropagation()}>
            <button className="admin-user-detail__close" onClick={() => setViewUser(null)}>✕</button>

            <div className="admin-user-detail__header">
              <div className="admin-user-detail__avatar">
                {(viewUser.name?.[0] || '?').toUpperCase()}
              </div>
              <div>
                <h2 className="admin-user-detail__name">
                  {[viewUser.surname, viewUser.name, viewUser.patronymic].filter(Boolean).join(' ') || '—'}
                </h2>
                <span className={`admin-table__role admin-table__role--${viewUser.role}`}>{viewUser.role}</span>
              </div>
            </div>

            <div className="admin-user-detail__grid">
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">ID</span>
                <span className="admin-user-detail__value">#{viewUser.id}</span>
              </div>
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Email</span>
                <span className="admin-user-detail__value">{viewUser.email}</span>
              </div>
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Телефон</span>
                <span className="admin-user-detail__value">{viewUser.phone || '—'}</span>
              </div>
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Пол</span>
                <span className="admin-user-detail__value">{genderLabel(viewUser.gender)}</span>
              </div>
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Дата рождения</span>
                <span className="admin-user-detail__value">{formatDate(viewUser.birth_date)}</span>
              </div>
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Адрес</span>
                <span className="admin-user-detail__value">{viewUser.address || '—'}</span>
              </div>
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Пароль</span>
                <span className="admin-user-detail__value" style={{ fontFamily: 'monospace', letterSpacing: '2px' }}>••••••••</span>
              </div>
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Роль</span>
                <span className="admin-user-detail__value">{viewUser.role}</span>
              </div>
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Дата регистрации</span>
                <span className="admin-user-detail__value">{formatDateTime(viewUser.created_at)}</span>
              </div>
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Последнее обновление</span>
                <span className="admin-user-detail__value">{formatDateTime(viewUser.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {viewLoading && (
        <div className="admin-modal-overlay">
          <div style={{ color: '#888', fontSize: '16px' }}>Загрузка...</div>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreateAdmin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }} onClick={() => setShowCreateAdmin(false)}>
          <form className="admin-login__card" onClick={(e) => e.stopPropagation()} onSubmit={handleCreateAdmin} style={{ background: '#161822', border: '1px solid #23263a' }}>
            <div className="admin-login__title">Новый администратор</div>
            <div className="admin-login__subtitle">Создайте новый аккаунт с правами admin</div>

            <label className="admin-login__label">Имя</label>
            <input className="admin-login__input" type="text" value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} placeholder="Имя" autoFocus />

            <label className="admin-login__label">Ник</label>
            <input className="admin-login__input" type="text" value={newAdmin.nickname} onChange={(e) => setNewAdmin({ ...newAdmin, nickname: e.target.value })} placeholder="Отображаемый ник (необязательно)" />

            <label className="admin-login__label">Email</label>
            <input className="admin-login__input" type="email" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} placeholder="admin@example.com" />

            <label className="admin-login__label">Пароль</label>
            <input className="admin-login__input" type="password" value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} placeholder="Минимум 6 символов" />

            {createError && <div className="admin-login__error">{createError}</div>}

            <button className="admin-login__btn" type="submit" disabled={createLoading || !newAdmin.name || !newAdmin.email || !newAdmin.password}>
              {createLoading ? 'Создание...' : 'Создать'}
            </button>
            <button type="button" className="admin-login__back" onClick={() => setShowCreateAdmin(false)}>Отмена</button>
          </form>
        </div>
      )}

      {/* Request Detail Modal */}
      {viewRequest && (
        <div className="admin-modal-overlay" onClick={() => setViewRequest(null)}>
          <div className="admin-user-detail" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <button className="admin-user-detail__close" onClick={() => setViewRequest(null)}>✕</button>

            <div className="admin-user-detail__header">
              <div className="admin-user-detail__avatar" style={{ background: viewRequest.status === 'new' ? '#ff6b6b' : viewRequest.status === 'processed' ? '#ffd43b' : '#51cf66', color: '#000' }}>
                {viewRequest.type === 'car' ? '🚗' : viewRequest.type === 'question' ? '❓' : viewRequest.type === 'order' ? '🛒' : '📞'}
              </div>
              <div>
                <h2 className="admin-user-detail__name">{viewRequest.name}</h2>
                <span className={`admin-request-status admin-request-status--${viewRequest.status}`}>{statusLabel(viewRequest.status)}</span>
              </div>
            </div>

            <div className="admin-user-detail__grid">
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">ID</span>
                <span className="admin-user-detail__value">#{viewRequest.id}</span>
              </div>
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Тип</span>
                <span className="admin-user-detail__value">{typeLabel(viewRequest.type)}</span>
              </div>
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Телефон</span>
                <span className="admin-user-detail__value"><a href={`tel:${viewRequest.phone}`} style={{ color: '#4f8cff' }}>{viewRequest.phone}</a></span>
              </div>
              {viewRequest.email && (
                <div className="admin-user-detail__field">
                  <span className="admin-user-detail__label">Email</span>
                  <span className="admin-user-detail__value">{viewRequest.email}</span>
                </div>
              )}
              {viewRequest.car_name && (
                <div className="admin-user-detail__field">
                  <span className="admin-user-detail__label">Автомобиль</span>
                  <span className="admin-user-detail__value">
                    {viewRequest.car_id ? (
                      <a href={`/catalog/${viewRequest.car_id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#4f8cff', textDecoration: 'none' }}>
                        🚗 {viewRequest.car_name}
                      </a>
                    ) : viewRequest.car_name}
                  </span>
                </div>
              )}
              {viewRequest.topic && (
                <div className="admin-user-detail__field">
                  <span className="admin-user-detail__label">Тема</span>
                  <span className="admin-user-detail__value">{viewRequest.topic}</span>
                </div>
              )}
              {viewRequest.order_number && (
                <div className="admin-user-detail__field">
                  <span className="admin-user-detail__label">Номер заказа</span>
                  <span className="admin-user-detail__value">{viewRequest.order_number}</span>
                </div>
              )}
              <div className="admin-user-detail__field">
                <span className="admin-user-detail__label">Дата</span>
                <span className="admin-user-detail__value">{formatDateTime(viewRequest.created_at)}</span>
              </div>
            </div>

            {viewRequest.message && (
              <div style={{ marginTop: 16 }}>
                <span className="admin-user-detail__label" style={{ display: 'block', marginBottom: 8 }}>Сообщение</span>
                <div style={{ background: '#1a1c2e', padding: '12px 16px', borderRadius: 8, color: '#ccc', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {viewRequest.message}
                </div>
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              {/* Claim section */}
              <div style={{ marginBottom: 16 }}>
                {viewRequest.claimed_by ? (
                  <span className="admin-claim-badge admin-claim-badge--claimed" style={{ fontSize: 14 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Ответственный: {viewRequest.claimed_by_name || viewRequest.claimed_by_email || 'Админ'}
                  </span>
                ) : (
                  <button className="admin-claim-btn" onClick={() => handleClaimRequest(viewRequest)}>
                    Взять на себя
                  </button>
                )}
              </div>

              <span style={{ color: '#888', fontSize: 13, display: 'block', marginBottom: 10 }}>Сменить статус:</span>
              <div className="admin-status-select">
                {['new', 'processed', 'closed'].map((s) => {
                  const isOrder = viewRequest.type === 'order';
                  const labels = isOrder
                    ? { new: '🕐 Новый', processed: '⚙️ В обработке', closed: '✅ Завершён' }
                    : { new: '🔴 Новая', processed: '🟡 В работе', closed: '🟢 Закрыта' };
                  const isActive = viewRequest.status === s;
                  return (
                    <button
                      key={s}
                      className={`admin-status-select__btn admin-status-select__btn--${s}${isActive ? ' admin-status-select__btn--active' : ''}`}
                      onClick={() => {
                        if (!isActive) {
                          handleChangeRequestStatus(viewRequest, s);
                          setViewRequest({ ...viewRequest, status: s });
                        }
                      }}
                    >
                      {labels[s]}
                    </button>
                  );
                })}
              </div>
              {viewRequest.type === 'order' && (
                <span style={{ fontSize: 12, color: '#666', marginTop: 10, display: 'block' }}>📧 Письмо будет отправлено автоматически</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Car Form Modal (Create / Edit) */}
      {showCarForm && (
        <div className="admin-modal-overlay">
          <form className="admin-car-form" onSubmit={handleCarFormSubmit}>
            <button type="button" className="admin-user-detail__close" onClick={() => setShowCarForm(false)}>✕</button>

            <div className="admin-car-form__header">
              <h2 className="admin-car-form__title">
                {editingCar ? `Редактировать: ${editingCar.brand || ''} ${editingCar.model || ''} ${editingCar.year || ''}`.trim() : 'Новое объявление'}
              </h2>
              <p className="admin-car-form__subtitle">
                {editingCar ? 'Измените данные авто' : 'Заполните информацию об автомобиле'}
              </p>
            </div>

            <div className="admin-car-form__grid">
              {CAR_FIELDS.map((f) => (
                <div key={f.key} className={`admin-car-form__field ${f.textarea ? 'admin-car-form__field--full' : ''}`}>
                  <label className="admin-car-form__label">
                    {f.label}
                    {f.required && <span className="admin-car-form__required">*</span>}
                  </label>
                  {f.select ? (
                    <select
                      className="admin-car-form__input"
                      value={carForm[f.key]}
                      onChange={(e) => setCarForm({ ...carForm, [f.key]: e.target.value })}
                      required={f.required}
                    >
                      <option value="">— Выберите —</option>
                      {f.select.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : f.textarea ? (
                    <textarea
                      className="admin-car-form__input admin-car-form__textarea"
                      value={carForm[f.key]}
                      onChange={(e) => setCarForm({ ...carForm, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      rows={3}
                      required={f.required}
                    />
                  ) : f.formatted ? (
                    <input
                      className="admin-car-form__input"
                      type="text"
                      value={carForm[f.key] ? Number(carForm[f.key]).toLocaleString('ru-RU') : ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d]/g, '');
                        setCarForm({ ...carForm, [f.key]: raw });
                      }}
                      placeholder={f.placeholder}
                      required={f.required}
                    />
                  ) : (
                    <input
                      className="admin-car-form__input"
                      type={f.type || 'text'}
                      value={carForm[f.key]}
                      onChange={(e) => setCarForm({ ...carForm, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      required={f.required}
                    />
                  )}
                </div>
              ))}

              {/* ── Discount toggle + old price ── */}
              <div className="admin-car-form__field admin-car-form__field--full">
                <label className="admin-car-form__checkbox">
                  <input
                    type="checkbox"
                    checked={carForm.hasDiscount}
                    onChange={(e) => setCarForm({ ...carForm, hasDiscount: e.target.checked, old_price: e.target.checked ? carForm.old_price : '' })}
                  />
                  <span>Скидка на автомобиль</span>
                </label>
                {carForm.hasDiscount && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label className="admin-car-form__label">
                        Старая цена (₽) <span className="admin-car-form__required">*</span>
                      </label>
                      <input
                        className="admin-car-form__input"
                        type="text"
                        value={carForm.old_price ? Number(carForm.old_price).toLocaleString('ru-RU') : ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d]/g, '');
                          setCarForm({ ...carForm, old_price: raw });
                        }}
                        placeholder="1 268 900"
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="admin-car-form__label">Цена со скидкой (₽)</label>
                      <input
                        className="admin-car-form__input"
                        type="text"
                        value={carForm.price ? Number(carForm.price).toLocaleString('ru-RU') + ' ₽' : ''}
                        disabled
                        style={{ opacity: 0.6 }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Photo Upload Zone ── */}
              <div className="admin-car-form__field admin-car-form__field--full">
                <label className="admin-car-form__label">
                  Фотографии ({carForm.images?.length || 0}/30)
                  {carForm.images?.length > 0 && <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 8, color: '#666' }}>Перетаскивайте для сортировки. Первое фото — обложка.</span>}
                </label>

                {/* Sortable image grid */}
                {carForm.images?.length > 0 && (
                  <div className="admin-upload-grid">
                    {carForm.images.map((url, idx) => (
                      <div
                        key={url + idx}
                        className={`admin-upload-grid__item ${dragIdx === idx ? 'admin-upload-grid__item--dragging' : ''} ${idx === 0 ? 'admin-upload-grid__item--cover' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                      >
                        <img src={url} alt={`Фото ${idx + 1}`} />
                        {idx === 0 && <span className="admin-upload-grid__badge">Обложка</span>}
                        <span className="admin-upload-grid__num">{idx + 1}</span>
                        <button type="button" className="admin-upload-grid__remove" onClick={() => removeImage(idx)} title="Удалить фото">✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Drop zone */}
                {(carForm.images?.length || 0) < 30 && (
                  <div
                    className="admin-upload-zone"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('admin-upload--dragover'); }}
                    onDragLeave={(e) => e.currentTarget.classList.remove('admin-upload--dragover')}
                    onDrop={handleFileDrop}
                    onClick={() => document.getElementById('car-file-input')?.click()}
                  >
                    <input
                      id="car-file-input"
                      type="file"
                      multiple
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileSelect}
                      ref={fileInputRef}
                    />
                    {uploadingImages ? (
                      <div className="admin-upload-zone__text">
                        <span className="admin-upload-zone__spinner" />
                        <span>Загрузка...</span>
                      </div>
                    ) : (
                      <div className="admin-upload-zone__text">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span>Перетащите фото сюда или нажмите для выбора</span>
                        <span style={{ fontSize: '11px', color: '#555' }}>JPG, PNG, WebP · до 10 МБ · макс. 30 фото</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* is_published toggle */}
              <div className="admin-car-form__field admin-car-form__field--full">
                <label className="admin-car-form__checkbox">
                  <input
                    type="checkbox"
                    checked={carForm.is_published}
                    onChange={(e) => setCarForm({ ...carForm, is_published: e.target.checked })}
                  />
                  <span>Опубликовать сразу</span>
                </label>
              </div>
            </div>

            {carFormError && <div className="admin-login__error">{carFormError}</div>}

            <div className="admin-car-form__actions">
              <button className="admin-login__btn" type="submit" disabled={carFormLoading || !carForm.brand || !carForm.price}>
                {carFormLoading ? 'Сохранение...' : editingCar ? 'Сохранить изменения' : 'Создать объявление'}
              </button>
              <button type="button" className="admin-login__back" onClick={() => setShowCarForm(false)}>Отмена</button>
            </div>
          </form>
        </div>
      )}

      {/* Notification Toasts */}
      {toasts.length > 0 && (
        <div className="admin-toasts">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`admin-toast admin-toast--${toast.type}`}
              onClick={() => handleToastClick(toast)}
            >
              <div className="admin-toast__icon">
                {toast.type === 'chat' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                )}
              </div>
              <div className="admin-toast__body">
                <div className="admin-toast__title">{toast.title}</div>
                <div className="admin-toast__message">
                  {toast.senderName && <strong>{toast.senderName}: </strong>}
                  {toast.message}
                </div>
                {toast.phone && <div className="admin-toast__phone">{toast.phone}</div>}
              </div>
              <button className="admin-toast__close" onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function AdminPanel() {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);

  /* Auto-login if token exists and user is admin */
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { queueMicrotask(() => setChecking(false)); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(({ user }) => {
        if (user?.role === 'admin') setAdmin(user);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return <div className="admin-overlay" style={{ alignItems: 'center', justifyContent: 'center', color: '#888' }}>Загрузка...</div>;
  }

  if (!admin) {
    return <AdminLogin onSuccess={setAdmin} />;
  }

  return <AdminDashboard admin={admin} />;
}

export default AdminPanel;
