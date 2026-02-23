import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchMyOrders } from '../../api/callbackRequests';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import './MyOrdersPage.css';

const STATUS_LABELS = { new: 'Новый', processed: 'В обработке', closed: 'Завершён' };
const STATUS_ICONS = {
  new: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  processed: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/><path d="M12 6v6l4 2"/>
    </svg>
  ),
  closed: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
};

export default function MyOrdersPage({ onAuthOpen }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchMyOrders()
      .then((data) => setOrders(data.requests || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <>
        <Header forceScrolled onAuthOpen={onAuthOpen} />
        <div className="my-orders">
          <div className="my-orders__inner">
            <p className="my-orders__empty">Войдите в аккаунт, чтобы видеть свои заказы.</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header forceScrolled onAuthOpen={onAuthOpen} />
      <div className="my-orders">
        <div className="my-orders__inner">
          {/* Breadcrumb */}
          <nav className="my-orders__breadcrumb">
            <a href="/" className="my-orders__breadcrumb-link" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Главная</a>
            <span className="my-orders__breadcrumb-sep">/</span>
            <a href="/cabinet" className="my-orders__breadcrumb-link" onClick={(e) => { e.preventDefault(); navigate('/cabinet'); }}>Кабинет</a>
            <span className="my-orders__breadcrumb-sep">/</span>
            <span className="my-orders__breadcrumb-current">Мои заказы</span>
          </nav>

          <h1 className="my-orders__heading">Мои заказы</h1>

          {loading ? (
            <p className="my-orders__empty">Загрузка...</p>
          ) : orders.length === 0 ? (
            <div className="my-orders__empty-block">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#d0d0d0" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              <p className="my-orders__empty-text">У вас пока нет заказов</p>
              <button className="my-orders__btn" onClick={() => navigate('/catalog')}>Перейти в каталог</button>
            </div>
          ) : (
            <div className="my-orders__list">
              {orders.map((order) => {
                const date = new Date(order.created_at);
                const carName = order.linked_car_name || order.car_name;
                const carImage = order.linked_car_image;

                return (
                  <div className="my-orders__card" key={order.id}>
                    {/* Status ribbon */}
                    <div className={`my-orders__ribbon my-orders__ribbon--${order.status}`}>
                      {STATUS_ICONS[order.status]}
                      <span>{STATUS_LABELS[order.status] || order.status}</span>
                    </div>

                    <div className="my-orders__card-content">
                      {/* Car preview */}
                      {carName && (
                        <div
                          className="my-orders__car"
                          onClick={() => order.car_id && navigate(`/catalog/${order.car_id}`)}
                          style={order.car_id ? { cursor: 'pointer' } : {}}
                        >
                          {carImage ? (
                            <img className="my-orders__car-img" src={carImage} alt={carName} />
                          ) : (
                            <div className="my-orders__car-img my-orders__car-img--placeholder">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                                <rect x="1" y="3" width="15" height="13" rx="2"/>
                                <path d="M16 8h4a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2v-1"/>
                              </svg>
                            </div>
                          )}
                          <div className="my-orders__car-info">
                            <span className="my-orders__car-name">{carName}</span>
                            {order.linked_car_year && (
                              <span className="my-orders__car-year">{order.linked_car_year} г.</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Order details */}
                      <div className="my-orders__details">
                        <div className="my-orders__detail">
                          <span className="my-orders__detail-label">Номер заказа</span>
                          <span className="my-orders__detail-value">#{order.order_number || order.id}</span>
                        </div>
                        <div className="my-orders__detail">
                          <span className="my-orders__detail-label">Дата</span>
                          <span className="my-orders__detail-value">
                            {date.toLocaleDateString('ru-RU', {
                              day: 'numeric', month: 'long', year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="my-orders__detail">
                          <span className="my-orders__detail-label">Телефон</span>
                          <span className="my-orders__detail-value">{order.phone}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
