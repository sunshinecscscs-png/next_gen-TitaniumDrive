import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchCarById } from '../../api/cars';
import { mapCar } from '../../utils/mapCar';
import { getViewedCarIds, removeViewedCar, clearViewedCars } from '../../utils/viewedCars';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import '../FavoritesPage/FavoritesPage.css';
import './ViewedCarsPage.css';

export default function ViewedCarsPage({ onAuthOpen }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = getViewedCarIds();
    if (!ids.length) { setLoading(false); return; }

    Promise.allSettled(ids.map(id => fetchCarById(id)))
      .then(results => {
        const loaded = results
          .filter(r => r.status === 'fulfilled' && r.value?.car)
          .map(r => mapCar(r.value.car));
        setCars(loaded);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = (carId) => {
    removeViewedCar(carId);
    setCars(prev => prev.filter(c => c.id !== carId));
  };

  const handleClearAll = () => {
    if (!confirm('Очистить историю просмотров?')) return;
    clearViewedCars();
    setCars([]);
  };

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
            <span className="favorites__breadcrumb-current">Просмотренные авто</span>
          </nav>

          <div className="viewed__header">
            <h1 className="favorites__heading">Просмотренные авто</h1>
            {cars.length > 0 && (
              <button className="viewed__clear-btn" onClick={handleClearAll}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                </svg>
                Очистить историю
              </button>
            )}
          </div>

          {loading ? (
            <p className="favorites__empty">Загрузка...</p>
          ) : cars.length === 0 ? (
            <div className="favorites__empty-block">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <p className="favorites__empty-text">Вы ещё не просматривали автомобили</p>
              <button className="favorites__btn" onClick={() => navigate('/catalog')}>Перейти в каталог</button>
            </div>
          ) : (
            <div className="favorites__grid">
              {cars.map(car => (
                <div className="favorites__card" key={car.id} onClick={() => navigate(`/catalog/${car.id}`)}>
                  <div className="favorites__card-img-wrap">
                    <img src={car.image} alt={car.name} className="favorites__card-img" />
                    <button
                      className="favorites__card-remove"
                      title="Убрать из просмотренных"
                      onClick={(e) => { e.stopPropagation(); handleRemove(car.id); }}
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
