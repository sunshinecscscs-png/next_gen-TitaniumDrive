import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchMyRequests } from '../../api/callbackRequests';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import './MyRequestsPage.css';

const TYPE_LABELS = { simple: 'Обратный звонок', car: 'Заявка на авто', question: 'Вопрос', order: 'Заказ' };
const STATUS_LABELS = { new: 'Новая', processed: 'В обработке', closed: 'Закрыта' };

export default function MyRequestsPage({ onAuthOpen }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchMyRequests()
      .then(data => setRequests(data.requests || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <>
        <Header forceScrolled onAuthOpen={onAuthOpen} />
        <div className="my-requests">
          <div className="my-requests__inner">
            <p className="my-requests__empty">Войдите в аккаунт, чтобы видеть свои заявки.</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header forceScrolled onAuthOpen={onAuthOpen} />
      <div className="my-requests">
        <div className="my-requests__inner">
          {/* Breadcrumb */}
          <nav className="my-requests__breadcrumb">
            <a href="/" className="my-requests__breadcrumb-link" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Главная</a>
            <span className="my-requests__breadcrumb-sep">/</span>
            <a href="/cabinet" className="my-requests__breadcrumb-link" onClick={(e) => { e.preventDefault(); navigate('/cabinet'); }}>Кабинет</a>
            <span className="my-requests__breadcrumb-sep">/</span>
            <span className="my-requests__breadcrumb-current">Мои заявки</span>
          </nav>

          <h1 className="my-requests__heading">Мои заявки</h1>

          {loading ? (
            <p className="my-requests__empty">Загрузка...</p>
          ) : requests.length === 0 ? (
            <div className="my-requests__empty-block">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
              <p className="my-requests__empty-text">У вас пока нет заявок</p>
              <button className="my-requests__btn" onClick={() => navigate('/catalog')}>Перейти в каталог</button>
            </div>
          ) : (
            <div className="my-requests__list">
              {requests.map(req => (
                <div className="my-requests__card" key={req.id}>
                  <div className="my-requests__card-header">
                    <span className={`my-requests__type my-requests__type--${req.type}`}>
                      {TYPE_LABELS[req.type] || req.type}
                    </span>
                    <span className={`my-requests__status my-requests__status--${req.status}`}>
                      {STATUS_LABELS[req.status] || req.status}
                    </span>
                  </div>

                  <div className="my-requests__card-body">
                    {req.car_name && (
                      <p className="my-requests__car-name">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="3" width="15" height="13" rx="2"/>
                          <path d="M16 8h4a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-1"/>
                        </svg>
                        {req.car_id ? (
                          <a
                            href={`/catalog/${req.car_id}`}
                            className="my-requests__car-link"
                            onClick={(e) => { e.preventDefault(); navigate(`/catalog/${req.car_id}`); }}
                          >
                            {req.linked_car_name || req.car_name}
                          </a>
                        ) : (
                          <span>{req.car_name}</span>
                        )}
                      </p>
                    )}
                    {req.topic && (
                      <p className="my-requests__topic">
                        <strong>Тема:</strong> {req.topic}
                      </p>
                    )}
                    {req.message && (
                      <p className="my-requests__message">{req.message}</p>
                    )}
                  </div>

                  <div className="my-requests__card-footer">
                    <span className="my-requests__date">
                      {new Date(req.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
