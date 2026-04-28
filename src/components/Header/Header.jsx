import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { fetchFavoriteIds } from '../../api/favorites.js';
import { fetchNotifications, fetchUnreadCount, markAllRead, markRead } from '../../api/notifications.js';
import './Header.css';

function Header({ onAuthOpen, forceScrolled }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(forceScrolled || false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  /* Reset favCount when user logs out */
  const computedFavCount = user ? favCount : 0;

  useEffect(() => {
    if (forceScrolled) return;
    const handleScroll = () => {
      setScrolled(window.scrollY > window.innerHeight - 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [forceScrolled]);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  /* Load favorites count */
  useEffect(() => {
    if (!user) return;
    const load = () => fetchFavoriteIds().then(ids => setFavCount(ids.length)).catch(() => {});
    load();
    window.addEventListener('favorites-changed', load);
    return () => window.removeEventListener('favorites-changed', load);
  }, [user]);

  /* Load unread notification count (poll every 30s) */
  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    const load = () => fetchUnreadCount().then(d => setUnreadCount(d.count)).catch(() => {});
    load();
    const interval = setInterval(load, 30000);
    window.addEventListener('notifications-changed', load);
    return () => { clearInterval(interval); window.removeEventListener('notifications-changed', load); };
  }, [user]);

  /* Close notification dropdown on outside click */
  useEffect(() => {
    if (!notifOpen) return;
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notifOpen]);

  /* Close profile dropdown on outside click */
  useEffect(() => {
    if (!profileOpen) return;
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileOpen]);

  const handleProfileClick = () => {
    if (user) {
      setProfileOpen((v) => !v);
    } else {
      onAuthOpen && onAuthOpen();
    }
  };

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
  };

  const handleBellClick = () => {
    if (!user) { onAuthOpen && onAuthOpen(); return; }
    if (!notifOpen) {
      fetchNotifications().then(d => setNotifications(d.notifications || [])).catch(() => {});
    }
    setNotifOpen(v => !v);
  };

  const handleMarkAllRead = async () => {
    await markAllRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    window.dispatchEvent(new Event('notifications-changed'));
  };

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      await markRead(notif.id).catch(() => {});
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setNotifOpen(false);
    if (notif.link) navigate(notif.link);
  };

  return (
    <>
      <header className={`header ${scrolled ? 'header--scrolled' : ''}`}>
        <div className="header__left">
          <button className="header__catalog-btn" onClick={() => navigate('/catalog')}><span>КАТАЛОГ</span></button>
          <button className="header__menu-btn" aria-label="Меню" onClick={() => setMenuOpen(true)}>
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>

        <a href="/" className="header__logo" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          <span className="header__logo-text">TitaniumDrive</span>
        </a>

        <div className="header__right">
          <button className="header__icon" aria-label="Поиск" onClick={() => navigate('/search')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
          <button className="header__icon header__icon--fav" aria-label="Избранное" onClick={() => user ? navigate('/cabinet/favorites') : onAuthOpen && onAuthOpen()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            {computedFavCount > 0 && <span className="header__badge">{computedFavCount}</span>}
          </button>
          <div className="header__notif-wrap" ref={notifRef}>
            <button className="header__icon header__icon--notif" aria-label="Уведомления" onClick={handleBellClick}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              {user && unreadCount > 0 && <span className="header__badge">{unreadCount}</span>}
            </button>

            {notifOpen && user && (
              <div className="notif-dropdown">
                <div className="notif-dropdown__header">
                  <span className="notif-dropdown__title">Уведомления</span>
                  {notifications.some(n => !n.is_read) && (
                    <button className="notif-dropdown__read-all" onClick={handleMarkAllRead}>Прочитать все</button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="notif-dropdown__empty">Нет уведомлений</p>
                ) : (
                  <div className="notif-dropdown__list">
                    {notifications.map(notif => (
                      <div
                        className={`notif-dropdown__item${notif.is_read ? '' : ' notif-dropdown__item--unread'}`}
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                      >
                        <div className="notif-dropdown__item-dot" />
                        <div className="notif-dropdown__item-body">
                          <span className="notif-dropdown__item-title">{notif.title}</span>
                          {notif.message && <span className="notif-dropdown__item-msg">{notif.message}</span>}
                          <span className="notif-dropdown__item-time">
                            {new Date(notif.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="header__profile-wrap" ref={profileRef}>
            <button className="header__icon" aria-label="Аккаунт" onClick={handleProfileClick}>
              {user ? (
                <span className="header__avatar">{user.name?.[0]?.toUpperCase() || 'U'}</span>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              )}
            </button>

            {profileOpen && user && (
              <div className="profile-dropdown">
                <div className="profile-dropdown__user">
                  <span className="profile-dropdown__avatar">{user.name?.[0]?.toUpperCase() || 'U'}</span>
                  <div className="profile-dropdown__info">
                    <span className="profile-dropdown__name">{user.name}</span>
                    {user.phone && <span className="profile-dropdown__phone">{user.phone}</span>}
                    {!user.phone && <span className="profile-dropdown__phone">{user.email}</span>}
                  </div>
                </div>

                <a href="/cabinet" className="profile-dropdown__link" onClick={(e) => { e.preventDefault(); setProfileOpen(false); navigate('/cabinet'); }}>
                  Мой кабинет
                </a>

                <div className="profile-dropdown__divider" />

                <button className="profile-dropdown__logout" onClick={handleLogout}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Выход
                </button>
              </div>
            )}
          </div>

          {/* Social icons */}
          <div className="header__socials">
            <a href="https://t.me/Titanium_Raif_RF" target="_blank" rel="noopener noreferrer" className="header__social-link" aria-label="Telegram">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </a>
            <a href="https://vk.com/dealerrugroup" target="_blank" rel="noopener noreferrer" className="header__social-link" aria-label="VK">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M21.547 7h-3.29a.743.743 0 00-.655.392s-1.312 2.416-1.734 3.23C14.734 12.813 14 12.126 14 11.11V7.603A1.104 1.104 0 0012.896 6.5h-2.474a1.982 1.982 0 00-1.75.813s1.255-.204 1.255 1.49c0 .42.022 1.626.04 2.64a.73.73 0 01-1.272.503 21.54 21.54 0 01-2.498-4.543.693.693 0 00-.63-.403H2.66a.742.742 0 00-.677 1.03c1.827 4.203 5.395 8.97 10.036 8.97h1.234a.742.742 0 00.742-.742v-1.135a.743.743 0 01.677-.742c.344-.029.663.18.803.49.577 1.284 1.084 2.13 1.084 2.13a.742.742 0 00.642.37h3.2a.743.743 0 00.666-1.073s-1.166-2.052-1.77-3.177a.741.741 0 01.078-.832C20.903 11.385 22.96 8.67 22.96 8.67A.745.745 0 0021.547 7z"/></svg>
            </a>
            <a href="https://max.ru/u/f9LHodD0cOLnHLfdFye_Ww3XqqYbzr7mxawADNuEUQr2TpDUzN1K1dusnkc" target="_blank" rel="noopener noreferrer" className="header__social-link header__social-link--max" aria-label="MAX">
              <img src="/icons/max.webp" alt="MAX" width="30" height="30" />
            </a>
          </div>
        </div>
      </header>

      {/* Side menu overlay */}
      <div className={`sidemenu-overlay ${menuOpen ? 'sidemenu-overlay--active' : ''}`} onClick={() => setMenuOpen(false)} />

      {/* Side menu panel */}
      <nav className={`sidemenu ${menuOpen ? 'sidemenu--open' : ''}`}>
        <button className="sidemenu__close" onClick={() => setMenuOpen(false)} aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M1 1L17 17M17 1L1 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="sidemenu__nav">
          <a href="/catalog" className="sidemenu__link" onClick={(e) => { e.preventDefault(); setMenuOpen(false); navigate('/catalog'); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            <span>Каталог</span>
          </a>
          <a href="/cabinet/favorites" className="sidemenu__link" onClick={(e) => { e.preventDefault(); setMenuOpen(false); user ? navigate('/cabinet/favorites') : onAuthOpen && onAuthOpen(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            <span>Избранное{computedFavCount > 0 ? ` (${computedFavCount})` : ''}</span>
          </a>
          <a href="#account" className="sidemenu__link" onClick={(e) => { e.preventDefault(); setMenuOpen(false); onAuthOpen && onAuthOpen(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>{user ? user.name : 'Войти | Зарегистрироваться'}</span>
          </a>
        </div>

        <div className="sidemenu__links">
          <a href="/contact" className="sidemenu__text-link" onClick={(e) => { e.preventDefault(); setMenuOpen(false); navigate('/contact'); }}>Связаться с нами</a>
          <a href="/about" className="sidemenu__text-link" onClick={(e) => { e.preventDefault(); setMenuOpen(false); navigate('/about'); }}>Про нас</a>
        </div>

      </nav>
    </>
  );
}

export default Header;
