import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import './CabinetPage.css';

const cards = [
  {
    key: 'requests',
    title: 'Мои запросы',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
      </svg>
    ),
  },
  {
    key: 'favorites',
    title: 'Желаемые авто',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
      </svg>
    ),
  },
  {
    key: 'viewed',
    title: 'Просмотренные авто',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="2"/>
        <path d="M16 8h4a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-1"/>
        <path d="M7 14h4"/>
      </svg>
    ),
  },
  {
    key: 'profile',
    title: 'Мой профиль',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
];

function CabinetPage({ onAuthOpen }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <>
        <Header forceScrolled onAuthOpen={onAuthOpen} />
        <div className="cabinet">
          <div className="cabinet__inner">
            <p className="cabinet__empty">Войдите в аккаунт, чтобы открыть кабинет.</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header forceScrolled onAuthOpen={onAuthOpen} />
      <div className="cabinet">
        <div className="cabinet__inner">
          {/* Breadcrumb */}
          <nav className="cabinet__breadcrumb">
            <a href="/" className="cabinet__breadcrumb-link" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Главная</a>
            <span className="cabinet__breadcrumb-sep">/</span>
            <span className="cabinet__breadcrumb-current">{user.name}</span>
          </nav>

          <h1 className="cabinet__heading">{user.name}</h1>

          {/* Cards grid */}
          <div className="cabinet__grid">
            {cards.map((card) => (
              <div className="cabinet__card" key={card.key} onClick={() => {
                if (card.key === 'profile') navigate('/cabinet/profile');
                if (card.key === 'favorites') navigate('/cabinet/favorites');
                if (card.key === 'viewed') navigate('/cabinet/viewed');
                if (card.key === 'requests') navigate('/cabinet/requests');
              }} style={{ cursor: 'pointer' }}>
                <span className="cabinet__card-icon">{card.icon}</span>
                <span className="cabinet__card-title">{card.title}</span>
                <span className="cabinet__card-arrow">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8l4 4-4 4"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default CabinetPage;
