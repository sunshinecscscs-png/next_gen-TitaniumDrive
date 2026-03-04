import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCars } from '../../api/cars';
import { toggleFavorite, fetchFavoriteIds } from '../../api/favorites';
import { useAuth } from '../../hooks/useAuth';
import { placeOrder } from '../../api/orders';
import { submitCallbackRequest } from '../../api/callbackRequests';
import { mapCar } from '../../utils/mapCar';
import { handlePhoneInput } from '../../utils/phoneFormat';
import CallbackModal from '../CallbackModal/CallbackModal';
import '../CatalogPage/CatalogPage.css';
import './RecommendedCars.css';

const fmtPrice = (v) => {
  const n = Number(v);
  return isNaN(n) ? v : n.toLocaleString('ru-RU');
};

/* Tag icons — reuse the same as catalog */
const TagIcon = ({ type }) => {
  const icons = {
    condition: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
    ),
    fuel: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 22V6a2 2 0 012-2h8a2 2 0 012 2v16"/>
        <path d="M15 10h2a2 2 0 012 2v3a2 2 0 002 2v0a2 2 0 002-2V8l-3-3"/>
        <rect x="6" y="8" width="6" height="4"/>
      </svg>
    ),
    drive: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>
      </svg>
    ),
    transmission: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/>
        <path d="M6 8v10M18 8v4a2 2 0 01-2 2H8"/>
      </svg>
    ),
    engine: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="6" width="20" height="12" rx="2"/>
        <path d="M6 6V4M18 6V4M6 18v2M18 18v2M10 10v4M14 10v4M10 12h4"/>
      </svg>
    ),
    power: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
    bodyType: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M7 17h10M5 13l2-5h10l2 5M3 17h18v-4H3z"/>
        <circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
      </svg>
    ),
  };
  return <span className="catalog-tag__icon">{icons[type]}</span>;
};

const tagLabels = {
  condition: 'Состояние авто',
  fuel: 'Топливо',
  drive: 'Привод',
  transmission: 'Коробка передач',
  engine: 'Объём двигателя',
  power: 'Макс. мощность',
  bodyType: 'Тип кузова',
};

function RecommendedCars({ onAuthOpen }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cars, setCars] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const visibleCount = 4;
  const maxOffset = Math.max(0, cars.length - visibleCount);

  /* Favorites */
  const [favIds, setFavIds] = useState(new Set());
  useEffect(() => {
    if (!user) { setFavIds(new Set()); return; }
    fetchFavoriteIds().then(ids => setFavIds(new Set(ids))).catch(() => {});
  }, [user]);

  /* Buy flow */
  const [buyContactOpen, setBuyContactOpen] = useState(false);
  const [buySuccessOpen, setBuySuccessOpen] = useState(false);
  const [buyPhone, setBuyPhone] = useState('');
  const [buySubmitting, setBuySubmitting] = useState(false);
  const [buyTargetCar, setBuyTargetCar] = useState(null);
  /* Guest buy (no auth) */
  const [buyGuestOpen, setBuyGuestOpen] = useState(false);
  const [buyGuestName, setBuyGuestName] = useState('');
  const [buyGuestPhone, setBuyGuestPhone] = useState('');

  /* Callback (3-dot) menu */
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuBtnRefs = useRef({});
  const [callbackCar, setCallbackCar] = useState(null);

  useEffect(() => {
    fetchCars({ limit: 12 })
      .then((data) => {
        const list = Array.isArray(data.cars) ? data.cars : [];
        setCars(list.map(mapCar));
        setTotalCount(data.total ?? list.length);
      })
      .catch(() => {});
  }, []);

  const handlePrev = () => setOffset((o) => Math.max(0, o - 1));
  const handleNext = () => setOffset((o) => Math.min(maxOffset, o + 1));

  /* Toggle favorite */
  const handleToggleFav = async (carId) => {
    if (!user) { onAuthOpen?.(); return; }
    setFavIds(prev => {
      const next = new Set(prev);
      if (next.has(carId)) next.delete(carId); else next.add(carId);
      return next;
    });
    try { await toggleFavorite(carId); } catch {
      setFavIds(prev => {
        const next = new Set(prev);
        if (next.has(carId)) next.delete(carId); else next.add(carId);
        return next;
      });
    }
  };

  /* Buy */
  const handleBuy = (targetCar) => {
    if (!user) {
      setBuyTargetCar(targetCar);
      setBuyGuestName('');
      setBuyGuestPhone('');
      setBuyGuestOpen(true);
      return;
    }
    setBuyTargetCar(targetCar);
    if (!user.phone) { setBuyPhone(''); setBuyContactOpen(true); }
    else submitOrder(targetCar, user.phone);
  };

  const submitOrder = async (orderCar, phone) => {
    setBuySubmitting(true);
    try {
      await placeOrder({ car_id: orderCar.id, phone });
      setBuyContactOpen(false);
      setBuySuccessOpen(true);
      window.dispatchEvent(new Event('notifications-changed'));
    } catch (err) { alert(err.message); }
    finally { setBuySubmitting(false); }
  };

  const handleBuyContactSubmit = (e) => {
    e.preventDefault();
    if (!buyPhone.trim()) return;
    submitOrder(buyTargetCar, buyPhone.trim());
  };

  /* Guest buy submit (no auth — uses callback request API) */
  const handleGuestBuySubmit = async (e) => {
    e.preventDefault();
    if (!buyGuestName.trim() || !buyGuestPhone.trim()) return;
    setBuySubmitting(true);
    try {
      await submitCallbackRequest({
        type: 'order',
        name: buyGuestName.trim(),
        phone: buyGuestPhone.trim(),
        car_id: buyTargetCar.id,
        car_name: buyTargetCar.name,
      });
      setBuyGuestOpen(false);
      setBuySuccessOpen(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setBuySubmitting(false);
    }
  };

  return (
    <section className="rec-cars">
      <h2 className="rec-cars__heading">Рекомендованные авто</h2>

      <div className="rec-cars__carousel">
        <button
          className="rec-cars__arrow rec-cars__arrow--left"
          onClick={handlePrev}
          disabled={offset === 0}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 4L7 12L15 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="rec-cars__track-wrapper">
          <div
            className="rec-cars__track"
            style={{ transform: `translateX(-${offset * (100 / visibleCount)}%)` }}
          >
            {cars.map((car) => (
              <div className="rec-cars__card" key={car.id}>
                <div className="catalog-card catalog-card--grid" onClick={() => navigate(`/catalog/${car.id}`)} style={{ cursor: 'pointer' }}>
                  {/* Image */}
                  <div className="catalog-card__images">
                    <div className="catalog-card__img-left">
                      <img src={car.image} alt={car.name} />
                      <span className="catalog-card__counter">1 / {car.images?.length || 1}</span>
                    </div>
                    <div className="catalog-card__img-right">
                      <img src={car.image2} alt={car.name} />
                      <button className="catalog-card__arrow" aria-label="Следующее фото">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="catalog-card__info">
                    <div className="catalog-card__row-top">
                      <div>
                        <h3 className="catalog-card__name">{car.name}</h3>
                        <p className="catalog-card__spec">{car.spec}</p>
                      </div>
                      <div className="catalog-card__price-block">
                        <div className="catalog-card__price-line">
                          {car.oldPrice && (
                            <span className="catalog-card__old-price">{car.oldPrice} ₽</span>
                          )}
                          <span className={`catalog-card__price ${car.oldPrice ? 'catalog-card__price--sale' : ''}`}>
                            {car.price} ₽
                          </span>
                        </div>
                        <span className="catalog-card__price-date">Цена актуальна на {car.date}</span>
                      </div>
                    </div>

                    {/* Color */}
                    <div className="catalog-card__color">
                      <span className="catalog-card__color-dot" style={{ background: car.color.hex }} />
                      <span>{car.color.name}</span>
                    </div>

                    {/* Tags grid */}
                    <div className="catalog-card__tags">
                      {Object.entries(car.tags).filter(([, v]) => v).map(([key, value]) => (
                        <div key={key} className="catalog-card__tag">
                          <TagIcon type={key} />
                          <div className="catalog-card__tag-text">
                            <span className="catalog-card__tag-label">{tagLabels[key]}</span>
                            <span className="catalog-card__tag-value">{value}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Bottom: mileage + buy */}
                    <div className="catalog-card__bottom">
                      <div className="catalog-card__location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                          <path d="M12 6v6l4 2"/>
                        </svg>
                        <span>{car.mileage ? `${Number(car.mileage).toLocaleString('ru-RU')} км` : '—'}</span>
                      </div>
                      <div className="catalog-card__actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className={`catalog-card__btn-icon${favIds.has(car.id) ? ' catalog-card__btn-icon--liked' : ''}`}
                          title="В избранное"
                          onClick={() => handleToggleFav(car.id)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill={favIds.has(car.id) ? '#e74c3c' : 'none'} stroke={favIds.has(car.id) ? '#e74c3c' : 'currentColor'} strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                          </svg>
                        </button>
                        <button className="catalog-card__btn catalog-card__btn--primary" onClick={() => handleBuy(car)}>Приобрести</button>
                        <div className="catalog-card__menu-wrapper">
                          <button
                            className="catalog-card__btn-icon"
                            title="Ещё"
                            ref={el => menuBtnRefs.current[car.id] = el}
                            onClick={() => {
                              if (openMenuId === car.id) { setOpenMenuId(null); return; }
                              const rect = menuBtnRefs.current[car.id]?.getBoundingClientRect();
                              if (rect) setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                              setOpenMenuId(car.id);
                            }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          className="rec-cars__arrow rec-cars__arrow--right"
          onClick={handleNext}
          disabled={offset >= maxOffset}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9 4L17 12L9 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="rec-cars__bottom">
        <div className="rec-cars__progress">
          <div
            className="rec-cars__progress-bar"
            style={{ width: `${((offset + visibleCount) / cars.length) * 100}%` }}
          ></div>
        </div>
        <button className="rec-cars__all-btn" onClick={() => navigate('/catalog')}>{totalCount} предложени{totalCount % 10 === 1 && totalCount % 100 !== 11 ? 'е' : 'й'}</button>
      </div>

      {/* Callback popup (3-dot menu) */}
      {openMenuId !== null && (
        <>
          <div className="catalog-card__popup-overlay" onClick={() => setOpenMenuId(null)} />
          <div className="catalog-card__popup catalog-card__popup--fixed" style={{ top: menuPos.top, right: menuPos.right }}>
            <button className="catalog-card__popup-item" onClick={() => {
              const car = cars.find(c => c.id === openMenuId);
              setCallbackCar(car || null);
              setOpenMenuId(null);
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
              Позвонить мне
            </button>
          </div>
        </>
      )}
      {callbackCar && (
        <CallbackModal
          carName={callbackCar.name}
          carId={callbackCar.id}
          onClose={() => setCallbackCar(null)}
        />
      )}

      {/* Buy — guest contact modal (not logged in) */}
      {buyGuestOpen && buyTargetCar && (
        <div className="buy-modal-overlay" onClick={() => setBuyGuestOpen(false)}>
          <div className="buy-modal" onClick={(e) => e.stopPropagation()}>
            <button className="buy-modal__close" onClick={() => setBuyGuestOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <div className="buy-modal__icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
            </div>
            <h3 className="buy-modal__title">Оставьте контактные данные</h3>
            <p className="buy-modal__text">Менеджер свяжется с вами по поводу автомобиля</p>
            <div className="buy-modal__car-preview">
              {buyTargetCar.image && <img src={buyTargetCar.image} alt={buyTargetCar.name} />}
              <div>
                <span className="buy-modal__car-name">{buyTargetCar.name}</span>
                <span className="buy-modal__car-price">{fmtPrice(buyTargetCar.price?.toString().replace(/[^\d]/g, '') || buyTargetCar.price)} ₽</span>
              </div>
            </div>
            <form className="buy-modal__form" onSubmit={handleGuestBuySubmit}>
              <input className="buy-modal__input" type="text" placeholder="Ваше имя" value={buyGuestName} onChange={(e) => setBuyGuestName(e.target.value)} required autoFocus />
              <input className="buy-modal__input" type="tel" placeholder="+7 (___) ___-__-__" value={buyGuestPhone} onChange={handlePhoneInput(setBuyGuestPhone)} required />
              <button className="buy-modal__submit" type="submit" disabled={buySubmitting}>{buySubmitting ? 'Отправляем...' : 'Оставить заявку'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Buy — contact modal */}
      {buyContactOpen && buyTargetCar && (
        <div className="buy-modal-overlay" onClick={() => setBuyContactOpen(false)}>
          <div className="buy-modal" onClick={(e) => e.stopPropagation()}>
            <button className="buy-modal__close" onClick={() => setBuyContactOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <div className="buy-modal__icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
            </div>
            <h3 className="buy-modal__title">Оставьте контактные данные</h3>
            <p className="buy-modal__text">Чтобы менеджер связался с вами по поводу вашего заказа</p>
            <div className="buy-modal__car-preview">
              {buyTargetCar.image && <img src={buyTargetCar.image} alt={buyTargetCar.name} />}
              <div>
                <span className="buy-modal__car-name">{buyTargetCar.name}</span>
                <span className="buy-modal__car-price">{fmtPrice(buyTargetCar.price?.toString().replace(/[^\d]/g, '') || buyTargetCar.price)} ₽</span>
              </div>
            </div>
            <form className="buy-modal__form" onSubmit={handleBuyContactSubmit}>
              <input className="buy-modal__input" type="tel" placeholder="+7 (___) ___-__-__" value={buyPhone} onChange={handlePhoneInput(setBuyPhone)} required autoFocus />
              <button className="buy-modal__submit" type="submit" disabled={buySubmitting}>{buySubmitting ? 'Оформляем...' : 'Оформить заказ'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Buy — success modal */}
      {buySuccessOpen && (
        <div className="buy-modal-overlay" onClick={() => setBuySuccessOpen(false)}>
          <div className="buy-modal" onClick={(e) => e.stopPropagation()}>
            <button className="buy-modal__close" onClick={() => setBuySuccessOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <div className="buy-modal__icon buy-modal__icon--success">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h3 className="buy-modal__title">Заказ оформлен!</h3>
            <p className="buy-modal__text">Менеджер свяжется с вами в ближайшее время.</p>
            {buyTargetCar && (
              <div className="buy-modal__car-preview">
                {buyTargetCar.image && <img src={buyTargetCar.image} alt={buyTargetCar.name} />}
                <div>
                  <span className="buy-modal__car-name">{buyTargetCar.name}</span>
                  <span className="buy-modal__car-price">{fmtPrice(buyTargetCar.price?.toString().replace(/[^\d]/g, '') || buyTargetCar.price)} ₽</span>
                </div>
              </div>
            )}
            <button className="buy-modal__submit" onClick={() => setBuySuccessOpen(false)}>Понятно</button>
          </div>
        </div>
      )}
    </section>
  );
}

export default RecommendedCars;
