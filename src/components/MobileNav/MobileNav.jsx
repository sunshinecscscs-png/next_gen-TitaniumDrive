import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import './MobileNav.css';

function MobileNav({ onAuthOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const tabs = [
    {
      label: 'Каталог',
      path: '/catalog',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
    {
      label: 'Поиск',
      path: '/search',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
      ),
    },
    {
      label: 'Избранное',
      path: '/cabinet/favorites',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      ),
      requiresAuth: true,
    },
    {
      label: user ? user.name : 'Войти',
      path: '/cabinet',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
      requiresAuth: true,
    },
  ];

  const handleClick = (tab) => {
    if (tab.requiresAuth && !user) {
      onAuthOpen && onAuthOpen();
      return;
    }
    navigate(tab.path);
  };

  return (
    <nav className="mobile-nav">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path || location.pathname.startsWith(tab.path + '/');
        return (
          <button
            key={tab.path}
            className={`mobile-nav__tab${isActive ? ' mobile-nav__tab--active' : ''}`}
            onClick={() => handleClick(tab)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default MobileNav;
