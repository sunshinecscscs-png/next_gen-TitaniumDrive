import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchFavorites, toggleFavorite } from '../../api/favorites';
import { mapCar } from '../../utils/mapCar';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import './FavoritesPage.css';

export default function FavoritesPage({ onAuthOpen }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchFavorites()
      .then(rawCars => setCars(rawCars.map(mapCar)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const handleToggleFav = async (carId) => {
    if (!user) { onAuthOpen(); return; }
    setCars(prev => prev.filter(c => c.id !== carId));
    try { await toggleFavorite(carId); } catch {
      /* rollback — re-fetch */
      fetchFavorites().then(rawCars => setCars(rawCars.map(mapCar))).catch(() => {});
    }
  };

  if (!user) {
    return (
      <>
        <Header forceScrolled onAuthOpen={onAuthOpen} />
        <div className="favorites">
          <div className="favorites__inner">
            <p className="favorites__empty">Войдите в аккаунт, чтобы видеть избранное.</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header forceScrolled onAuthOpen={onAuthOpen} />
      <div className="favorites">
        <div className="favorites__inner">
          {/* Breadcrumb */}
          <nav className="favorites__breadcrumb">
            <a href="/" className="favorites__breadcrumb-link" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Главная</a>
            <span className="favorites__breadcrumb-sep">/</span>
            <a href="/cabinet" className="favorites__breadcrumb-link" onClick={(e) => { e.preventDefault(); navigate('/cabinet'); }}>Кабинет</a>
            <span className="favorites__breadcrumb-sep">/</span>
            <span className="favorites__breadcrumb-current">Желаемые авто</span>
          </nav>

          <h1 className="favorites__heading">Желаемые авто</h1>

          {loading ? (
            <p className="favorites__empty">Загрузка...</p>
          ) : cars.length === 0 ? (
            <div className="favorites__empty-block">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
              <p className="favorites__empty-text">У вас пока нет избранных авто</p>
              <button className="favorites__btn" onClick={() => navigate('/catalog')}>Перейти в каталог</button>
            </div>
          ) : (
            <div className="favorites__grid">
              {cars.map(car => (
                <div className="favorites__card" key={car.id} onClick={() => navigate(`/catalog/${car.id}`)}>
                  <div className="favorites__card-img-wrap">
                    <img src={car.image} alt={car.name} className="favorites__card-img" />
                    <button
                      className="favorites__card-heart favorites__card-heart--active"
                      title="Убрать из избранного"
                      onClick={(e) => { e.stopPropagation(); handleToggleFav(car.id); }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#e74c3c" stroke="#e74c3c" strokeWidth="1.5">
                        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                      </svg>
                    </button>
                    <button
                      className="favorites__card-remove"
                      title="Удалить из избранного"
                      onClick={(e) => { e.stopPropagation(); handleToggleFav(car.id); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                        <path d="M10 11v6"/>
                        <path d="M14 11v6"/>
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                      </svg>
                    </button>
                  </div>
                  <div className="favorites__card-body">
                    <h3 className="favorites__card-name">{car.name}</h3>
                    {car.spec && <p className="favorites__card-spec">{car.spec}</p>}
                    <div className="favorites__card-tags">
                      {car.tags.condition && <span className="favorites__tag">{car.tags.condition}</span>}
                      {car.tags.fuel && <span className="favorites__tag">{car.tags.fuel}</span>}
                      {car.tags.transmission && <span className="favorites__tag">{car.tags.transmission}</span>}
                    </div>
                    <div className="favorites__card-bottom">
                      <div className="favorites__card-price">
                        <span className={`favorites__price${car.oldPrice ? ' favorites__price--sale' : ''}`}>{car.price} ₽</span>
                        {car.oldPrice && <span className="favorites__price-old">{car.oldPrice} ₽</span>}
                      </div>
                      <div className="favorites__card-city">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {car.city}
                      </div>
                    </div>
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
