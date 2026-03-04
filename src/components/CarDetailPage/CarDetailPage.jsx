import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import { fetchCarById } from '../../api/cars';
import { toggleFavorite, fetchFavoriteIds } from '../../api/favorites';
import { addViewedCar } from '../../utils/viewedCars';
import { useAuth } from '../../hooks/useAuth';
import { mapCar } from '../../utils/mapCar';
import { placeOrder } from '../../api/orders';
import { submitCallbackRequest } from '../../api/callbackRequests';
import { handlePhoneInput } from '../../utils/phoneFormat';
import { isMoscowWorkingHours } from '../../utils/workHours';
import './CarDetailPage.css';

export default function CarDetailPage({ onAuthOpen }) {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [car, setCar] = useState(null);
  const [carLoading, setCarLoading] = useState(true);
  const [similarCars, setSimilarCars] = useState([]);
  const [favIds, setFavIds] = useState(new Set());

  const [activeTab, setActiveTab] = useState('appearance');
  const [mainImage, setMainImage] = useState(0);
  const [openSections, setOpenSections] = useState({ appearance: true, specs: true, equipment: false, condition: false, description: false });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const sidebarRef = useRef(null);

  /* Buy modals */
  const [buyContactOpen, setBuyContactOpen] = useState(false);
  const [buySuccessOpen, setBuySuccessOpen] = useState(false);
  const [buyPhone, setBuyPhone] = useState('');
  const [buySubmitting, setBuySubmitting] = useState(false);
  const [buyTargetCar, setBuyTargetCar] = useState(null);
  /* Guest buy (no auth) */
  const [buyGuestOpen, setBuyGuestOpen] = useState(false);
  const [buyGuestName, setBuyGuestName] = useState('');
  const [buyGuestPhone, setBuyGuestPhone] = useState('');
  /* Phone call modal */
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  useEffect(() => {
    fetchCarById(id)
      .then(data => {
        setCar(mapCar(data.car));
        addViewedCar(data.car.id);
      })
      .catch(() => setCar(null))
      .finally(() => setCarLoading(false));
  }, [id]);

  useEffect(() => {
    import('../../api/cars').then(({ fetchCars }) =>
      fetchCars({ limit: 6 }).then(data =>
        setSimilarCars((data.cars || []).filter(c => c.id !== Number(id)).map(mapCar))
      )
    ).catch(() => {});
  }, [id]);

  /* Load user favorites */
  useEffect(() => {
    if (!user) { setFavIds(new Set()); return; }
    fetchFavoriteIds()
      .then(ids => setFavIds(new Set(ids)))
      .catch(() => {});
  }, [user]);

  const handleToggleFav = async (carId) => {
    if (!user) { onAuthOpen(); return; }
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

  /* ── Buy flow ── */
  const handleBuy = (targetCar) => {
    if (!user) {
      setBuyTargetCar(targetCar || car);
      setBuyGuestName('');
      setBuyGuestPhone('');
      setBuyGuestOpen(true);
      return;
    }
    setBuyTargetCar(targetCar || car);
    if (!user.phone) {
      setBuyPhone('');
      setBuyContactOpen(true);
    } else {
      submitOrder(targetCar || car, user.phone);
    }
  };

  const submitOrder = async (orderCar, phone) => {
    setBuySubmitting(true);
    try {
      await placeOrder({ car_id: orderCar?.id || car.id, phone });
      setBuyContactOpen(false);
      setBuySuccessOpen(true);
      window.dispatchEvent(new Event('notifications-changed'));
    } catch (err) {
      alert(err.message);
    } finally {
      setBuySubmitting(false);
    }
  };

  const handleContactSubmit = (e) => {
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
      const targetId = buyTargetCar?.id || car.id;
      const targetName = buyTargetCar?.name || car.name;
      await submitCallbackRequest({
        type: 'order',
        name: buyGuestName.trim(),
        phone: buyGuestPhone.trim(),
        car_id: targetId,
        car_name: targetName,
      });
      setBuyGuestOpen(false);
      setBuySuccessOpen(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setBuySubmitting(false);
    }
  };

  if (carLoading) {
    return (
      <div className="car-detail" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="car-detail" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Автомобиль не найден</h2>
          <button onClick={() => navigate('/catalog')} style={{ marginTop: 16, padding: '10px 24px', background: '#111', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Вернуться в каталог
          </button>
        </div>
      </div>
    );
  }

  // Use real images array from DB
  const gallery = car.images?.length ? car.images : [car.image, car.image2].filter(Boolean);


  const toggleSection = (key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const nextLightbox = () => setLightboxIndex(i => (i + 1) % gallery.length);
  const prevLightbox = () => setLightboxIndex(i => (i - 1 + gallery.length) % gallery.length);

  const specs = car.tags || {};

  const specItems = [
    { icon: 'condition', label: 'Состояние авто', value: specs.condition },
    { icon: 'fuel', label: 'Топливо', value: specs.fuel },
    { icon: 'drive', label: 'Привод', value: specs.drive },
    { icon: 'transmission', label: 'Коробка передач', value: specs.transmission },
    { icon: 'engine', label: 'Объём двигателя', value: specs.engine },
    { icon: 'power', label: 'Мощность', value: specs.power },
    { icon: 'bodyType', label: 'Кузов', value: specs.bodyType },
    { icon: 'mileage', label: 'Пробег', value: car.mileage ? `${Number(car.mileage).toLocaleString('ru-RU')} км` : null },
  ];

  const specIcons = {
    condition: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
    ),
    fuel: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 22V6a2 2 0 012-2h8a2 2 0 012 2v16"/><path d="M15 10h2a2 2 0 012 2v4a2 2 0 002 2"/><path d="M3 22h12"/><rect x="6" y="8" width="6" height="4" rx="1"/></svg>
    ),
    drive: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>
    ),
    transmission: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><path d="M6 8v8M12 8v4M18 8v8"/><path d="M6 16h12"/></svg>
    ),
    engine: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="8" width="16" height="10" rx="2"/><path d="M8 8V6M16 8V6M2 13h2M20 13h2"/></svg>
    ),
    power: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    ),
    bodyType: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 17h14M7 11l2-4h6l2 4"/><rect x="3" y="11" width="18" height="6" rx="2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
    ),
    mileage: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
    ),
  };

  const tabs = [
    { key: 'appearance', label: 'Внешний вид' },
    { key: 'specs', label: 'Технические характеристики' },
    ...(car.features && car.features.length > 0 ? [{ key: 'equipment', label: 'Комплектация' }] : []),
    { key: 'condition', label: 'Состояние' },
  ];

  const scrollToSection = (key) => {
    setActiveTab(key);
    // Open the accordion section so there's content to scroll to
    setOpenSections(prev => ({ ...prev, [key]: true }));
    // Small delay to let the accordion render before scrolling
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(`detail-section-${key}`);
        if (el) {
          const container = document.querySelector('.car-detail');
          const headerH = document.querySelector('.car-detail__header-wrap')?.offsetHeight || 80;
          const elTop = el.getBoundingClientRect().top + container.scrollTop - container.getBoundingClientRect().top - headerH - 16;
          container.scrollTo({ top: elTop, behavior: 'smooth' });
        }
      }, 50);
    });
  };

  return (
    <div className="car-detail">
      {/* Header */}
      <div className="car-detail__header-wrap">
        <Header
          onAuthOpen={onAuthOpen}
          forceScrolled
        />
      </div>

      <div className="car-detail__content">
        {/* Breadcrumbs */}
        <div className="car-detail__breadcrumbs">
          <a href="/" className="car-detail__breadcrumb" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Главная</a>
          <span className="car-detail__breadcrumb-sep">/</span>
          <a href="/catalog" className="car-detail__breadcrumb" onClick={(e) => { e.preventDefault(); navigate('/catalog'); }}>Автомобили на продаже</a>
          <span className="car-detail__breadcrumb-sep">/</span>
          <span className="car-detail__breadcrumb car-detail__breadcrumb--active">{car.name}</span>
        </div>

        {/* Title */}
        <div className="car-detail__title-block">
          <h1 className="car-detail__title">{car.name}</h1>
          <p className="car-detail__subtitle">{car.spec}</p>
        </div>

        {/* Tabs */}
        <div className="car-detail__tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`car-detail__tab${activeTab === tab.key ? ' car-detail__tab--active' : ''}`}
              onClick={() => scrollToSection(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Gallery */}
        <div className="car-detail__gallery">
          <div className="car-detail__gallery-main" onClick={() => openLightbox(mainImage)}>
            <img src={gallery[mainImage]} alt={car.name} />
          </div>
          <div className="car-detail__gallery-side">
            <div className="car-detail__gallery-side-img" onClick={() => openLightbox(mainImage === 0 ? 1 : 0)}>
              <img src={gallery[mainImage === 0 ? 1 : 0]} alt={car.name} />
            </div>
            <div className="car-detail__gallery-thumbs">
              {gallery.slice(0, 6).map((img, i) => (
                <div
                  key={i}
                  className={`car-detail__thumb${mainImage === i ? ' car-detail__thumb--active' : ''}`}
                  onClick={() => setMainImage(i)}
                >
                  <img src={img} alt={`${car.name} фото ${i + 1}`} />
                </div>
              ))}
              <div className="car-detail__thumb car-detail__thumb--more" onClick={() => openLightbox(0)}>
                <span>Все фото<br />({gallery.length})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Spec strip */}
        <div className="car-detail__spec-strip">
          {specItems.filter(s => s.value).map((item, i) => (
            <div className="car-detail__spec-item" key={i}>
              <div className="car-detail__spec-icon">{specIcons[item.icon]}</div>
              <div className="car-detail__spec-text">
                <span className="car-detail__spec-label">{item.label}</span>
                <span className="car-detail__spec-value">{item.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Two-column layout: details + sidebar */}
        <div className="car-detail__body">
          {/* Left column — info sections */}
          <div className="car-detail__info">
            {/* Appearance section */}
            <div className="car-detail__section" id="detail-section-appearance">
              <button className="car-detail__section-header" onClick={() => toggleSection('appearance')}>
                <span>Внешний вид</span>
                <svg className={`car-detail__section-arrow${openSections.appearance ? ' car-detail__section-arrow--open' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {openSections.appearance && (
                <div className="car-detail__section-body">
                  {car.color.name && (
                    <div className="car-detail__detail-row">
                      <span className="car-detail__detail-label">Цвет</span>
                      <div className="car-detail__detail-value">
                        <span className="car-detail__color-dot" style={{ background: car.color.hex }}></span>
                        {car.color.name}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tech specs section */}
            <div className="car-detail__section" id="detail-section-specs">
              <button className="car-detail__section-header" onClick={() => toggleSection('specs')}>
                <span>Технические характеристики</span>
                <svg className={`car-detail__section-arrow${openSections.specs ? ' car-detail__section-arrow--open' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {openSections.specs && (
                <div className="car-detail__section-body">
                  <div className="car-detail__specs-grid">
                    {/* Left column */}
                    <div className="car-detail__specs-col">

                      {/* Общее */}
                      <div className="car-detail__specs-group">
                        <div className="car-detail__specs-group-title">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
                          Общее
                        </div>
                        {specs.condition && <div className="car-detail__specs-row"><span>Состояние авто</span><span>{specs.condition}</span></div>}
                        {car.year && <div className="car-detail__specs-row"><span>Год производства</span><span>{car.year}</span></div>}
                        {car.brand && <div className="car-detail__specs-row"><span>Марка</span><span>{car.brand}</span></div>}
                        {car.model && <div className="car-detail__specs-row"><span>Модель</span><span>{car.model}</span></div>}
                        {specs.bodyType && <div className="car-detail__specs-row"><span>Кузов</span><span>{specs.bodyType}</span></div>}
                      </div>

                      {/* Двигатель */}
                      {(specs.fuel || specs.engine) && (
                        <div className="car-detail__specs-group">
                          <div className="car-detail__specs-group-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 8V4M8 4h8"/><rect x="5" y="8" width="14" height="12" rx="2"/><path d="M2 13h3M19 13h3"/></svg>
                            Двигатель
                          </div>
                          {specs.fuel && <div className="car-detail__specs-row"><span>Тип топлива</span><span>{specs.fuel}</span></div>}
                          {specs.engine && <div className="car-detail__specs-row"><span>Объём двигателя</span><span>{specs.engine}</span></div>}
                          {specs.power && <div className="car-detail__specs-row"><span>Мощность</span><span>{specs.power}</span></div>}
                          {car.cylinders && <div className="car-detail__specs-row"><span>Цилиндры</span><span>{car.cylinders}</span></div>}
                          {specs.consumption && <div className="car-detail__specs-row"><span>Расход топлива</span><span>{specs.consumption}</span></div>}
                          {car.fuel_tank && <div className="car-detail__specs-row"><span>Ёмкость бака</span><span>{car.fuel_tank}</span></div>}
                          {car.co2_emissions && <div className="car-detail__specs-row"><span>Выбросы CO2</span><span>{car.co2_emissions}</span></div>}
                        </div>
                      )}

                      {/* Размеры и масса */}
                      {(car.seats || car.doors || car.weight) && (
                        <div className="car-detail__specs-group">
                          <div className="car-detail__specs-group-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                            Размеры и масса
                          </div>
                          {car.seats && <div className="car-detail__specs-row"><span>Количество мест</span><span>{car.seats}</span></div>}
                          {car.doors && <div className="car-detail__specs-row"><span>Число дверей</span><span>{car.doors}</span></div>}
                          {car.weight && <div className="car-detail__specs-row"><span>Масса</span><span>{car.weight} кг</span></div>}
                          {specs.trunk && <div className="car-detail__specs-row"><span>Багажник</span><span>{specs.trunk}</span></div>}
                        </div>
                      )}

                    </div>

                    {/* Right column */}
                    <div className="car-detail__specs-col">

                      {/* Привод */}
                      {(specs.drive || specs.transmission) && (
                        <div className="car-detail__specs-group">
                          <div className="car-detail__specs-group-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>
                            Привод
                          </div>
                          {specs.drive && <div className="car-detail__specs-row"><span>Тип привода</span><span>{specs.drive}</span></div>}
                          {specs.transmission && <div className="car-detail__specs-row"><span>Коробка передач</span><span>{specs.transmission}</span></div>}
                        </div>
                      )}

                      {/* Цвет и внешний вид */}
                      {(car.color.name || car.interior) && (
                        <div className="car-detail__specs-group">
                          <div className="car-detail__specs-group-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 010 20 15 15 0 010-20"/><path d="M2 12h20"/></svg>
                            Цвет и отделка
                          </div>
                          {car.color.name && <div className="car-detail__specs-row"><span>Цвет кузова</span><span>{car.color.name}</span></div>}
                          {car.interior && <div className="car-detail__specs-row"><span>Салон</span><span>{car.interior}</span></div>}
                        </div>
                      )}

                      {/* Безопасность и комфорт */}
                      {(car.airbags || car.climate) && (
                        <div className="car-detail__specs-group">
                          <div className="car-detail__specs-group-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            Безопасность и комфорт
                          </div>
                          {car.airbags && <div className="car-detail__specs-row"><span>Подушки безопасности</span><span>{car.airbags}</span></div>}
                          {car.climate && <div className="car-detail__specs-row"><span>Климатизация</span><span>{car.climate}</span></div>}
                        </div>
                      )}

                      {/* Экология */}
                      {(car.eco_class || car.env_sticker) && (
                        <div className="car-detail__specs-group">
                          <div className="car-detail__specs-group-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"/></svg>
                            Экология
                          </div>
                          {car.eco_class && <div className="car-detail__specs-row"><span>Экокласс</span><span>{car.eco_class}</span></div>}
                          {car.env_sticker && <div className="car-detail__specs-row"><span>Наклейка безвредности</span><span>{car.env_sticker}</span></div>}
                        </div>
                      )}



                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Equipment / Features section */}
            {car.features && car.features.length > 0 && (
              <div className="car-detail__section" id="detail-section-equipment">
                <button className="car-detail__section-header" onClick={() => toggleSection('equipment')}>
                  <span>Комплектация ({car.features.length})</span>
                  <svg className={`car-detail__section-arrow${openSections.equipment ? ' car-detail__section-arrow--open' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                {openSections.equipment && (
                  <div className="car-detail__section-body">
                    <div className="car-detail__features-grid">
                      {car.features.map((feat, i) => (
                        <div className="car-detail__feature-item" key={i}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Condition section */}
            <div className="car-detail__section" id="detail-section-condition">
              <button className="car-detail__section-header" onClick={() => toggleSection('condition')}>
                <span>Состояние</span>
                <svg className={`car-detail__section-arrow${openSections.condition ? ' car-detail__section-arrow--open' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {openSections.condition && (
                <div className="car-detail__section-body">
                  {specs.condition && (
                    <div className="car-detail__detail-row">
                      <span className="car-detail__detail-label">Состояние</span>
                      <span className="car-detail__detail-value">{specs.condition}</span>
                    </div>
                  )}
                  <div className="car-detail__detail-row">
                    <span className="car-detail__detail-label">Пробег</span>
                    <span className="car-detail__detail-value">{car.mileage ? `${Number(car.mileage).toLocaleString('ru-RU')} км` : '0 км'}</span>
                  </div>
                  {car.year && (
                    <div className="car-detail__detail-row">
                      <span className="car-detail__detail-label">Год</span>
                      <span className="car-detail__detail-value">{car.year}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Description section */}
            <div className="car-detail__section" id="detail-section-description">
              <button className="car-detail__section-header" onClick={() => toggleSection('description')}>
                <span>Описание {car.name}</span>
                <svg className={`car-detail__section-arrow${openSections.description ? ' car-detail__section-arrow--open' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {openSections.description && (
                <div className="car-detail__section-body">
                  <div className="car-detail__description">
                    {car.description ? (
                      <p className="car-detail__description-text" style={{ whiteSpace: 'pre-line' }}>{car.description}</p>
                    ) : (
                      <p className="car-detail__description-text" style={{ color: '#999' }}>Описание не указано</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right column — sidebar */}
          <div className="car-detail__sidebar" ref={sidebarRef}>
            <div className="car-detail__sidebar-card">
              <h2 className="car-detail__sidebar-name">{car.name}</h2>
              <p className="car-detail__sidebar-spec">{car.spec}</p>

              <div className="car-detail__sidebar-price">
                <span className={`car-detail__price-current${car.oldPrice ? ' car-detail__price-current--sale' : ''}`}>{car.price} ₽</span>
                {car.oldPrice && (
                  <span className="car-detail__price-old">{car.oldPrice} ₽</span>
                )}
              </div>
              {car.oldPrice && (
                <p className="car-detail__price-note">Цена со скидкой до {car.date}</p>
              )}



              <div className="car-detail__sidebar-actions">
                <button className={`car-detail__action-icon${favIds.has(car.id) ? ' car-detail__action-icon--liked' : ''}`} title="В избранное" onClick={() => handleToggleFav(car.id)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={favIds.has(car.id) ? '#e74c3c' : 'none'} stroke={favIds.has(car.id) ? '#e74c3c' : 'currentColor'} strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                </button>

              </div>

              <button className="car-detail__btn car-detail__btn--primary" onClick={() => handleBuy(car)}>Приобрести</button>
              <button className="car-detail__btn car-detail__btn--outline" onClick={() => setPhoneModalOpen(true)}>Набрать номер</button>
            </div>
          </div>
        </div>
      </div>

        {/* Similar offers */}
        {(() => {
          const similar = similarCars;
          if (!similar.length) return null;
          return (
            <div className="car-detail__similar">
              <h2 className="car-detail__similar-title">Доступные предложения в других комплектациях</h2>
              <div className="car-detail__similar-list">
                {similar.map(item => (
                  <div key={item.id} className="car-detail__similar-card" onClick={() => navigate(`/catalog/${item.id}`)}>
                    <div className="car-detail__similar-img">
                      <img src={item.image} alt={item.name} />
                    </div>
                    <div className="car-detail__similar-info">
                      <div className="car-detail__similar-top">
                        <div>
                          <h3 className="car-detail__similar-name">{item.name}</h3>
                          <p className="car-detail__similar-spec">{item.spec}</p>
                        </div>
                        <div className="car-detail__similar-prices">
                          {item.oldPrice && <span className="car-detail__similar-old">{item.oldPrice} ₽</span>}
                          <span className={`car-detail__similar-price${item.oldPrice ? ' car-detail__similar-price--sale' : ''}`}>{item.price} ₽</span>
                          <span className="car-detail__similar-date">Цена на {item.date}</span>
                        </div>
                      </div>
                      <div className="car-detail__similar-color">
                        <span className="car-detail__color-dot" style={{ background: item.color.hex }}></span>
                        {item.color.name}
                      </div>
                      <div className="car-detail__similar-tags">
                        {item.tags.condition && <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>{item.tags.condition}</span>}
                        {item.tags.fuel && <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 22V6a2 2 0 012-2h8a2 2 0 012 2v16"/></svg>{item.tags.fuel}</span>}
                        {item.tags.drive && <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>{item.tags.drive}</span>}
                        {item.tags.transmission && <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><path d="M6 8v8M12 8v4"/></svg>{item.tags.transmission}</span>}
                        {item.tags.engine && <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="8" width="16" height="10" rx="2"/><path d="M8 8V6M16 8V6"/></svg>{item.tags.engine}</span>}
                        {item.tags.power && <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>{item.tags.power}</span>}
                      </div>
                      <div className="car-detail__similar-bottom">
                        <div className="car-detail__similar-actions">
                          <button className={`car-detail__similar-icon${favIds.has(item.id) ? ' car-detail__similar-icon--liked' : ''}`} title="В избранное" onClick={() => handleToggleFav(item.id)}><svg width="18" height="18" viewBox="0 0 24 24" fill={favIds.has(item.id) ? '#e74c3c' : 'none'} stroke={favIds.has(item.id) ? '#e74c3c' : 'currentColor'} strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></button>
                          <button className="car-detail__similar-btn car-detail__similar-btn--primary" onClick={(e) => { e.stopPropagation(); handleBuy(item); }}>Приобрести</button>
                          <button className="car-detail__similar-btn car-detail__similar-btn--call" onClick={(e) => { e.stopPropagation(); setPhoneModalOpen(true); }}>Набрать номер</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Footer */}
        <Footer />

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="car-detail__lightbox" onClick={closeLightbox}>
          <div className="car-detail__lightbox-inner" onClick={e => e.stopPropagation()}>
            <button className="car-detail__lightbox-close" onClick={closeLightbox}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <button className="car-detail__lightbox-arrow car-detail__lightbox-arrow--left" onClick={prevLightbox}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <img src={gallery[lightboxIndex]} alt={car.name} className="car-detail__lightbox-img" />
            <button className="car-detail__lightbox-arrow car-detail__lightbox-arrow--right" onClick={nextLightbox}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <div className="car-detail__lightbox-counter">{lightboxIndex + 1} / {gallery.length}</div>
          </div>
        </div>
      )}

      {/* Phone call modal */}
      {phoneModalOpen && (
        <div className="buy-modal-overlay" onClick={() => setPhoneModalOpen(false)}>
          <div className="buy-modal" onClick={e => e.stopPropagation()}>
            <button className="buy-modal__close" onClick={() => setPhoneModalOpen(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <div className="buy-modal__icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
            </div>
            <h3 className="buy-modal__title">Позвоните нам</h3>
            <p className="buy-modal__text">Наш менеджер ответит на все ваши вопросы</p>
            <a href="tel:+79820780996" className="buy-modal__phone-link">8 (800) 505-51-99</a>
          </div>
        </div>
      )}

      {/* Buy — guest contact modal (not logged in) */}
      {buyGuestOpen && (
        <div className="buy-modal-overlay" onClick={() => setBuyGuestOpen(false)}>
          <div className="buy-modal" onClick={e => e.stopPropagation()}>
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
            {buyTargetCar && (
              <div className="buy-modal__car-preview">
                {buyTargetCar.image && <img src={buyTargetCar.image} alt={buyTargetCar.name} />}
                <div>
                  <span className="buy-modal__car-name">{buyTargetCar.name}</span>
                  <span className="buy-modal__car-price">{buyTargetCar.price} ₽</span>
                </div>
              </div>
            )}
            <form onSubmit={handleGuestBuySubmit} className="buy-modal__form">
              <input type="text" className="buy-modal__input" placeholder="Ваше имя" value={buyGuestName} onChange={e => setBuyGuestName(e.target.value)} autoFocus required />
              <input type="tel" className="buy-modal__input" placeholder="+7 (___) ___-__-__" value={buyGuestPhone} onChange={handlePhoneInput(setBuyGuestPhone)} required />
              <button type="submit" className="buy-modal__submit" disabled={buySubmitting}>
                {buySubmitting ? 'Отправляем...' : 'Оставить заявку'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Buy — Contact form modal */}
      {buyContactOpen && (
        <div className="buy-modal-overlay" onClick={() => setBuyContactOpen(false)}>
          <div className="buy-modal" onClick={e => e.stopPropagation()}>
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
            {buyTargetCar && (
              <div className="buy-modal__car-preview">
                {buyTargetCar.image && <img src={buyTargetCar.image} alt={buyTargetCar.name} />}
                <div>
                  <span className="buy-modal__car-name">{buyTargetCar.name}</span>
                  <span className="buy-modal__car-price">{buyTargetCar.price} ₽</span>
                </div>
              </div>
            )}
            <form onSubmit={handleContactSubmit} className="buy-modal__form">
              <input
                type="tel"
                className="buy-modal__input"
                placeholder="+7 (___) ___-__-__"
                value={buyPhone}
                onChange={handlePhoneInput(setBuyPhone)}
                autoFocus
                required
              />
              <button type="submit" className="buy-modal__submit" disabled={buySubmitting}>
                {buySubmitting ? 'Оформление...' : 'Оформить заказ'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Buy — Success modal */}
      {buySuccessOpen && (
        <div className="buy-modal-overlay" onClick={() => setBuySuccessOpen(false)}>
          <div className="buy-modal buy-modal--success" onClick={e => e.stopPropagation()}>
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
            <p className="buy-modal__text">{isMoscowWorkingHours()
              ? 'Менеджер свяжется с вами в течение 10 минут. Информация о заказе отправлена на вашу почту.'
              : 'Рабочий день уже завершён — менеджер свяжется с вами завтра. Информация о заказе отправлена на вашу почту.'}</p>
            {buyTargetCar && (
              <div className="buy-modal__car-preview">
                {buyTargetCar.image && <img src={buyTargetCar.image} alt={buyTargetCar.name} />}
                <div>
                  <span className="buy-modal__car-name">{buyTargetCar.name}</span>
                  <span className="buy-modal__car-price">{buyTargetCar.price} ₽</span>
                </div>
              </div>
            )}
            <button className="buy-modal__submit" onClick={() => setBuySuccessOpen(false)}>Понятно</button>
          </div>
        </div>
      )}
    </div>
  );
}
