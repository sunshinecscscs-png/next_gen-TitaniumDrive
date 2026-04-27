import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './CatalogPage.css';
import { fetchCars } from '../../api/cars';
import { toggleFavorite, fetchFavoriteIds } from '../../api/favorites';
import { useAuth } from '../../hooks/useAuth';
import { mapCar } from '../../utils/mapCar';
import CallbackModal from '../CallbackModal/CallbackModal';
import NoResultsModal from '../NoResultsModal/NoResultsModal';
import { placeOrder } from '../../api/orders';
import { submitCallbackRequest } from '../../api/callbackRequests';
import { formatPhone, handlePhoneInput } from '../../utils/phoneFormat';
import { isMoscowWorkingHours } from '../../utils/workHours';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';

/* Format number with space as thousands separator */
const fmtPrice = (v) => {
  const n = Number(v);
  return isNaN(n) ? v : n.toLocaleString('ru-RU');
};

/* Dual-thumb range slider */
const DualRange = ({ min, max, valueMin, valueMax, step, onMinChange, onMaxChange }) => {
  const lo = Number(min) || 0;
  const hi = Number(max) || 100;
  const st = Number(step) || 1;
  const vMin = Math.max(lo, Math.min(Number(valueMin) || lo, hi));
  const vMax = Math.max(lo, Math.min(Number(valueMax) || hi, hi));
  const pctL = hi > lo ? ((vMin - lo) / (hi - lo)) * 100 : 0;
  const pctR = hi > lo ? ((vMax - lo) / (hi - lo)) * 100 : 100;
  return (
    <div className="dual-range">
      <div className="dual-range__track">
        <div className="dual-range__fill" style={{ left: `${pctL}%`, width: `${pctR - pctL}%` }} />
      </div>
      <input type="range" className="dual-range__input" min={lo} max={hi} step={st}
        value={vMin} onChange={(e) => { const v = Number(e.target.value); if (v <= vMax) onMinChange(String(v)); }} />
      <input type="range" className="dual-range__input" min={lo} max={hi} step={st}
        value={vMax} onChange={(e) => { const v = Number(e.target.value); if (v >= vMin) onMaxChange(String(v)); }} />
    </div>
  );
};

/* Tag icon mini components */
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
    consumption: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 22V6a2 2 0 012-2h8a2 2 0 012 2v16"/>
        <path d="M7 12h4M7 16h4"/>
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
    acceleration: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="14" r="8"/>
        <path d="M12 14l3-6"/>
        <path d="M4 14h2M18 14h2M12 6v2"/>
      </svg>
    ),
    trunk: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="8" width="18" height="12" rx="2"/>
        <path d="M8 8V6a4 4 0 018 0v2"/>
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
  consumption: 'Расход топлива',
  engine: 'Объём двигателя',
  power: 'Макс. мощность',
  acceleration: 'Разгон',
  trunk: 'Объём багажника',
  bodyType: 'Тип кузова',
};

function CatalogPage({ onAuthOpen }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedCondition, setSelectedCondition] = useState('Все');
  const [selectedBrands, setSelectedBrands] = useState(() => {
    const b = searchParams.get('brand');
    return b ? [b] : [];
  });
  const [selectedModels, setSelectedModels] = useState(() => {
    const m = searchParams.get('model');
    return m ? [m] : [];
  });
  const [sortBy, setSortBy] = useState('recommended');
  const [viewMode, setViewMode] = useState('list');
  const [brandSearch, setBrandSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);
  const [priceMin, setPriceMin] = useState(() => searchParams.get('price_min') || '');
  const [priceMax, setPriceMax] = useState(() => searchParams.get('price_max') || '');
  const [selectedDiscount, setSelectedDiscount] = useState('Все');
  const [mileageMin, setMileageMin] = useState('0');
  const [mileageMax, setMileageMax] = useState('200000');
  const [yearMin, setYearMin] = useState('2010');
  const [yearMax, setYearMax] = useState('2026');
  const [selectedBodyTypes, setSelectedBodyTypes] = useState(() => {
    const bt = searchParams.get('body_type');
    return bt ? [bt] : [];
  });
  const [bodySearch, setBodySearch] = useState('');
  const [showAllBodies, setShowAllBodies] = useState(false);
  const [selectedTransmissions, setSelectedTransmissions] = useState([]);
  const [selectedFuels, setSelectedFuels] = useState([]);
  const [selectedDrives, setSelectedDrives] = useState([]);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuBtnRefs = useRef({});
  const [callbackCar, setCallbackCar] = useState(null);
  const [favIds, setFavIds] = useState(new Set());
  /* Buy modals */
  const [buyContactOpen, setBuyContactOpen] = useState(false);
  const [buyPhone, setBuyPhone] = useState('');
  const [buySubmitting, setBuySubmitting] = useState(false);
  const [buyTargetCar, setBuyTargetCar] = useState(null);
  /* Guest buy (no auth) */
  const [buyGuestOpen, setBuyGuestOpen] = useState(false);
  const [buyGuestName, setBuyGuestName] = useState('');
  const [buyGuestPhone, setBuyGuestPhone] = useState('');
  const [dbCars, setDbCars] = useState([]);
  const [carsLoading, setCarsLoading] = useState(true);
  const [noResultsOpen, setNoResultsOpen] = useState(false);
  const navigate = useNavigate();
  const [collapsedFilters, setCollapsedFilters] = useState({
    transmission: true, fuel: true, drive: true,
  });

  /* ── Lock body scroll when mobile filter is open ── */
  useEffect(() => {
    if (mobileFilterOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileFilterOpen]);

  /* ── Dynamic facets from API ── */
  const [facets, setFacets] = useState({
    conditions: [{ name: 'Все', count: 0 }],
    brands: [],
    models: [],
    bodyTypes: [],
    transmissions: [],
    fuels: [],
    drives: [],
    discounts: [{ name: 'Все', count: 0 }],
    priceMin: 0, priceMax: 0,
    yearMin: 2010, yearMax: 2026,
    total: 0,
  });

  /* ── Load user's favorite IDs ── */
  useEffect(() => {
    if (!user) { setFavIds(new Set()); return; }
    fetchFavoriteIds()
      .then(ids => setFavIds(new Set(ids)))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetch('/api/cars/stats/counts')
      .then(r => r.json())
      .then(data => {
        setFacets(data);
        if (!priceMin) setPriceMin(String(data.priceMin || 0));
        if (!priceMax) setPriceMax(String(data.priceMax || 0));
        if (!yearMin) setYearMin('2010');
        if (!yearMax) setYearMax('2026');
      })
      .catch(() => {});
  }, []);

  const toggleFilter = (key) => {
    setCollapsedFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  /* ── Build API params from current filters ── */
  const buildParams = useCallback(() => {
    const p = { limit: 200 };
    if (selectedCondition && selectedCondition !== 'Все') p.condition = selectedCondition;
    if (selectedBrands.length) p.brand = selectedBrands.join(',');
    if (selectedModels.length) p.model = selectedModels.join(',');
    if (selectedBodyTypes.length) p.body_type = selectedBodyTypes.join(',');
    if (selectedFuels.length) p.fuel = selectedFuels.join(',');
    if (selectedDrives.length) p.drive = selectedDrives.join(',');
    if (selectedTransmissions.length) p.transmission = selectedTransmissions.join(',');
    if (priceMin && Number(priceMin) > 0) p.price_min = priceMin;
    if (priceMax && Number(priceMax) > 0) p.price_max = priceMax;
    if (yearMin) p.year_min = yearMin;
    if (yearMax) p.year_max = yearMax;
    if (Number(mileageMin) > 0) p.mileage_min = mileageMin;
    if (Number(mileageMax) > 0 && Number(mileageMax) < 500000) p.mileage_max = mileageMax;
    if (selectedDiscount === 'Со скидкой') p.discount = 'yes';
    else if (selectedDiscount === 'Без скидки') p.discount = 'no';
    const sortMap = { 'price-asc': 'price_asc', 'price-desc': 'price_desc', newest: 'date_desc', recommended: 'date_desc' };
    if (sortMap[sortBy]) p.sort = sortMap[sortBy];
    return p;
  }, [selectedCondition, selectedBrands, selectedModels, selectedBodyTypes, selectedFuels, selectedDrives, selectedTransmissions, priceMin, priceMax, yearMin, yearMax, mileageMin, mileageMax, selectedDiscount, sortBy]);

  /* ── Load cars from API (re-fetches when any filter changes) ── */
  useEffect(() => {
    setCarsLoading(true);
    const p = buildParams();
    fetchCars(p)
      .then(data => setDbCars((data.cars || []).map(mapCar)))
      .catch(() => {})
      .finally(() => setCarsLoading(false));
  }, [buildParams]);

  const filteredCars = dbCars;

  /* ── Build a human-readable criteria string for the "no results" form ── */
  const buildCriteriaText = useCallback(() => {
    const parts = [];
    if (selectedCondition && selectedCondition !== 'Все') parts.push(`Состояние: ${selectedCondition}`);
    if (selectedBrands.length) parts.push(`Марка: ${selectedBrands.join(', ')}`);
    if (selectedModels.length) parts.push(`Модель: ${selectedModels.join(', ')}`);
    if (selectedBodyTypes.length) parts.push(`Кузов: ${selectedBodyTypes.join(', ')}`);
    if (selectedTransmissions.length) parts.push(`КПП: ${selectedTransmissions.join(', ')}`);
    if (selectedFuels.length) parts.push(`Топливо: ${selectedFuels.join(', ')}`);
    if (selectedDrives.length) parts.push(`Привод: ${selectedDrives.join(', ')}`);
    if ((priceMin && Number(priceMin) > (facets.priceMin || 0)) || (priceMax && Number(priceMax) < (facets.priceMax || 0))) {
      parts.push(`Цена: ${fmtPrice(priceMin)} – ${fmtPrice(priceMax)} ₽`);
    }
    if (yearMin !== '2010' || yearMax !== '2026') parts.push(`Год: ${yearMin}–${yearMax}`);
    if (Number(mileageMin) > 0 || Number(mileageMax) < 200000) parts.push(`Пробег: ${fmtPrice(mileageMin)}–${fmtPrice(mileageMax)} км`);
    if (selectedDiscount && selectedDiscount !== 'Все') parts.push(`Скидка: ${selectedDiscount}`);
    return parts.join('; ');
  }, [selectedCondition, selectedBrands, selectedModels, selectedBodyTypes, selectedTransmissions, selectedFuels, selectedDrives, priceMin, priceMax, yearMin, yearMax, mileageMin, mileageMax, selectedDiscount, facets.priceMin, facets.priceMax]);

  /* ── Show "no results" popup when filters yield nothing (debounced) ── */
  useEffect(() => {
    if (carsLoading) return;
    if (filteredCars.length > 0) return;
    if (!facets.total || facets.total === 0) return; /* DB is empty — don't pester */
    if (sessionStorage.getItem('noResultsDismissed')) return;
    const t = setTimeout(() => setNoResultsOpen(true), 800);
    return () => clearTimeout(t);
  }, [carsLoading, filteredCars.length, facets.total]);

  const handleNoResultsClose = () => {
    setNoResultsOpen(false);
    sessionStorage.setItem('noResultsDismissed', '1');
  };

  const toggleBrand = (brand) => {
    setSelectedBrands(prev =>
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    );
  };

  const toggleModel = (model) => {
    setSelectedModels(prev =>
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    );
  };

  const toggleBodyType = (body) => {
    setSelectedBodyTypes(prev =>
      prev.includes(body) ? prev.filter(b => b !== body) : [...prev, body]
    );
  };

  const toggleTransmission = (tr) => {
    setSelectedTransmissions(prev =>
      prev.includes(tr) ? prev.filter(t => t !== tr) : [...prev, tr]
    );
  };

  const toggleFuel = (fuel) => {
    setSelectedFuels(prev =>
      prev.includes(fuel) ? prev.filter(f => f !== fuel) : [...prev, fuel]
    );
  };

  const toggleDrive = (drive) => {
    setSelectedDrives(prev =>
      prev.includes(drive) ? prev.filter(d => d !== drive) : [...prev, drive]
    );
  };

  /* ── Toggle favorite (heart button) ── */
  const handleToggleFav = async (carId) => {
    if (!user) { onAuthOpen(); return; }
    /* optimistic update */
    setFavIds(prev => {
      const next = new Set(prev);
      if (next.has(carId)) next.delete(carId); else next.add(carId);
      return next;
    });
    try {
      await toggleFavorite(carId);
    } catch {
      /* rollback on error */
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
      setBuyTargetCar(targetCar);
      setBuyGuestName('');
      setBuyGuestPhone('');
      setBuyGuestOpen(true);
      return;
    }
    setBuyTargetCar(targetCar);
    if (!user.phone) {
      setBuyPhone('');
      setBuyContactOpen(true);
    } else {
      submitOrder(targetCar, user.phone);
    }
  };

  const submitOrder = async (orderCar, phone) => {
    setBuySubmitting(true);
    try {
      await placeOrder({ car_id: orderCar.id, phone });
      setBuyContactOpen(false);
      window.dispatchEvent(new Event('notifications-changed'));
      navigate('/success');
    } catch (err) {
      alert(err.message);
    } finally {
      setBuySubmitting(false);
    }
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
      navigate('/success');
    } catch (err) {
      alert(err.message);
    } finally {
      setBuySubmitting(false);
    }
  };

  const filteredBrands = (facets.brands || []).filter(b =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const filteredModelsArr = (facets.models || []).filter(m =>
    m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
    (m.value && m.value.toLowerCase().includes(modelSearch.toLowerCase()))
  );

  const filteredBodyTypes = (facets.bodyTypes || []).filter(b =>
    b.name.toLowerCase().includes(bodySearch.toLowerCase())
  );

  const filteredExtColors = [];

  return (
    <div className="catalog-page">
      {/* Main Header */}
      <Header
        forceScrolled
        onAuthOpen={onAuthOpen}
      />
      <div className="catalog-page__header-spacer" />

      <div className="catalog-page__body">
        {/* Breadcrumb + Title */}
        <div className="catalog-page__top">
          <div className="catalog-page__breadcrumb">
            <a href="/" className="catalog-page__breadcrumb-link" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Главная</a>
            <span className="catalog-page__breadcrumb-sep">/</span>
            <span>Автомобили на продажу</span>
          </div>
          <h1 className="catalog-page__title">Автомобили на продажу</h1>
        </div>

        {/* Toolbar */}
        <div className="catalog-page__toolbar">
          <div className="catalog-page__toolbar-left">
            <button className="catalog-page__filter-btn" onClick={() => setMobileFilterOpen(v => !v)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
              </svg>
              <span className="catalog-page__filter-btn-label">Фильтры</span>
            </button>
            <div className="catalog-page__sort">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="recommended">Рекомендованные</option>
                <option value="price-asc">Цена: по возрастанию</option>
                <option value="price-desc">Цена: по убыванию</option>
                <option value="newest">Новые</option>
              </select>
            </div>
          </div>
          <div className="catalog-page__toolbar-right">
            <button
              className={`catalog-page__view-btn ${viewMode === 'list' ? 'catalog-page__view-btn--active' : ''}`}
              onClick={() => setViewMode('list')}
              title="Список"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button
              className={`catalog-page__view-btn ${viewMode === 'grid' ? 'catalog-page__view-btn--active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Сетка"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="4" height="4"/><rect x="10" y="3" width="4" height="4"/><rect x="17" y="3" width="4" height="4"/>
                <rect x="3" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/><rect x="17" y="10" width="4" height="4"/>
                <rect x="3" y="17" width="4" height="4"/><rect x="10" y="17" width="4" height="4"/><rect x="17" y="17" width="4" height="4"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Content area: sidebar + listings */}
        <div className="catalog-page__content">
          {/* Mobile overlay */}
          {mobileFilterOpen && <div className="catalog-page__sidebar-overlay" onClick={() => setMobileFilterOpen(false)} />}
          {/* Left sidebar filters */}
          <aside className={`catalog-page__sidebar${mobileFilterOpen ? ' catalog-page__sidebar--open' : ''}`}>
            <div className="catalog-page__sidebar-header">
              <span className="catalog-page__sidebar-header-title">Фильтры</span>
              <button className="catalog-page__sidebar-close" onClick={() => setMobileFilterOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="catalog-page__sidebar-scroll">
            {/* Condition filter */}
            <div className="catalog-filter-block">
              <h3 className="catalog-filter-block__title" onClick={() => toggleFilter('condition')}>
                СОСТОЯНИЕ АВТО
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedFilters.condition ? 'rotate(180deg)' : 'none' }}><path d="M18 15l-6-6-6 6"/></svg>
              </h3>
              {!collapsedFilters.condition && (
              <div className="catalog-filter-block__options">
                {(facets.conditions || []).map(cond => (
                  <label key={cond.name} className="catalog-filter-block__radio">
                    <input
                      type="radio"
                      name="condition"
                      checked={selectedCondition === cond.name}
                      onChange={() => setSelectedCondition(cond.name)}
                    />
                    <span className="catalog-filter-block__radio-mark" />
                    <span className="catalog-filter-block__label">{cond.name}</span>
                    <span className="catalog-filter-block__count">{cond.count}</span>
                  </label>
                ))}
              </div>
              )}
            </div>

            {/* Brand filter */}
            <div className="catalog-filter-block">
              <h3 className="catalog-filter-block__title" onClick={() => toggleFilter('brand')}>
                МАРКА
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedFilters.brand ? 'rotate(180deg)' : 'none' }}><path d="M18 15l-6-6-6 6"/></svg>
              </h3>
              {!collapsedFilters.brand && (<>
              <div className="catalog-filter-block__search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Mercedes-Benz"
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                />
              </div>
              <div className="catalog-filter-block__options">
                {filteredBrands.slice(0, showAllBrands ? undefined : 5).map(brand => (
                  <label key={brand.name} className="catalog-filter-block__checkbox">
                    <input
                      type="checkbox"
                      checked={selectedBrands.includes(brand.name)}
                      onChange={() => toggleBrand(brand.name)}
                    />
                    <span className="catalog-filter-block__check-mark" />
                    <span className="catalog-filter-block__label">{brand.name}</span>
                    <span className="catalog-filter-block__count">{brand.count}</span>
                  </label>
                ))}
              </div>
              {filteredBrands.length > 5 && (
                <button className="catalog-filter-block__more" onClick={() => setShowAllBrands(!showAllBrands)}>
                  {showAllBrands ? 'Скрыть' : 'Показать больше'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d={showAllBrands ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"}/>
                  </svg>
                </button>
              )}
              </>)}
            </div>

            {/* Model filter */}
            <div className="catalog-filter-block">
              <h3 className="catalog-filter-block__title" onClick={() => toggleFilter('model')}>
                МОДЕЛЬ
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedFilters.model ? 'rotate(180deg)' : 'none' }}><path d="M18 15l-6-6-6 6"/></svg>
              </h3>
              {!collapsedFilters.model && (<>
              <div className="catalog-filter-block__search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Cupra Ateca 2026"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                />
              </div>
              <div className="catalog-filter-block__options">
                {filteredModelsArr.slice(0, showAllModels ? undefined : 5).map(model => (
                  <label key={model.name} className="catalog-filter-block__checkbox">
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model.value)}
                      onChange={() => toggleModel(model.value)}
                    />
                    <span className="catalog-filter-block__check-mark" />
                    <span className="catalog-filter-block__label">{model.name}</span>
                    <span className="catalog-filter-block__count">{model.count}</span>
                  </label>
                ))}
              </div>
              {filteredModelsArr.length > 5 && (
                <button className="catalog-filter-block__more" onClick={() => setShowAllModels(!showAllModels)}>
                  {showAllModels ? 'Скрыть' : 'Показать больше'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d={showAllModels ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"}/>
                  </svg>
                </button>
              )}
              </>)}
            </div>

            {/* Price filter */}
            <div className="catalog-filter-block">
              <h3 className="catalog-filter-block__title" onClick={() => toggleFilter('price')}>
                ЦЕНА
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedFilters.price ? 'rotate(180deg)' : 'none' }}><path d="M18 15l-6-6-6 6"/></svg>
              </h3>
              {!collapsedFilters.price && (<>
              <div className="catalog-filter-block__range-labels">
                <span>{fmtPrice(priceMin)} ₽</span>
                <span>{fmtPrice(priceMax)} ₽</span>
              </div>
              <DualRange min={facets.priceMin || 0} max={facets.priceMax || 0} step={10000} valueMin={priceMin} valueMax={priceMax} onMinChange={setPriceMin} onMaxChange={setPriceMax} />
              <div className="catalog-filter-block__range-inputs">
                <input
                  type="text"
                  className="catalog-filter-block__range-input"
                  value={fmtPrice(priceMin)}
                  onChange={(e) => setPriceMin(e.target.value.replace(/\s/g, '').replace(/[^0-9]/g, ''))}
                />
                <span className="catalog-filter-block__range-dash">–</span>
                <input
                  type="text"
                  className="catalog-filter-block__range-input"
                  value={fmtPrice(priceMax)}
                  onChange={(e) => setPriceMax(e.target.value.replace(/\s/g, '').replace(/[^0-9]/g, ''))}
                />
                <button className="catalog-filter-block__ok">OK</button>
              </div>
              </>)}
            </div>

            {/* Discount filter */}
            <div className="catalog-filter-block">
              <h3 className="catalog-filter-block__title" onClick={() => toggleFilter('discount')}>
                СКИДКА
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedFilters.discount ? 'rotate(180deg)' : 'none' }}><path d="M18 15l-6-6-6 6"/></svg>
              </h3>
              {!collapsedFilters.discount && (
              <div className="catalog-filter-block__options">
                {(facets.discounts || []).map(opt => (
                  <label key={opt.name} className="catalog-filter-block__radio">
                    <input
                      type="radio"
                      name="discount"
                      checked={selectedDiscount === opt.name}
                      onChange={() => setSelectedDiscount(opt.name)}
                    />
                    <span className="catalog-filter-block__radio-mark" />
                    <span className="catalog-filter-block__label">{opt.name}</span>
                    <span className="catalog-filter-block__count">{opt.count}</span>
                  </label>
                ))}
              </div>
              )}
            </div>

            {/* Mileage filter */}
            <div className="catalog-filter-block">
              <h3 className="catalog-filter-block__title" onClick={() => toggleFilter('mileage')}>
                ПРОБЕГ
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedFilters.mileage ? 'rotate(180deg)' : 'none' }}><path d="M18 15l-6-6-6 6"/></svg>
              </h3>
              {!collapsedFilters.mileage && (<>
              <div className="catalog-filter-block__range-labels">
                <span>{fmtPrice(mileageMin)} км</span>
                <span>{fmtPrice(mileageMax)} км</span>
              </div>
              <DualRange min={0} max={200000} step={1000} valueMin={mileageMin} valueMax={mileageMax} onMinChange={setMileageMin} onMaxChange={setMileageMax} />
              <div className="catalog-filter-block__range-inputs">
                <input
                  type="text"
                  className="catalog-filter-block__range-input"
                  value={fmtPrice(mileageMin)}
                  onChange={(e) => setMileageMin(e.target.value.replace(/\s/g, '').replace(/[^0-9]/g, ''))}
                />
                <span className="catalog-filter-block__range-dash">–</span>
                <input
                  type="text"
                  className="catalog-filter-block__range-input"
                  value={fmtPrice(mileageMax)}
                  onChange={(e) => setMileageMax(e.target.value.replace(/\s/g, '').replace(/[^0-9]/g, ''))}
                />
                <button className="catalog-filter-block__ok">OK</button>
              </div>
              </>)}
            </div>

            {/* Year filter */}
            <div className="catalog-filter-block">
              <h3 className="catalog-filter-block__title" onClick={() => toggleFilter('year')}>
                ГОД ВЫПУСКА
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedFilters.year ? 'rotate(180deg)' : 'none' }}><path d="M18 15l-6-6-6 6"/></svg>
              </h3>
              {!collapsedFilters.year && (<>
              <div className="catalog-filter-block__range-labels">
                <span>2010</span>
                <span>2026</span>
              </div>
              <DualRange min={2010} max={2026} step={1} valueMin={yearMin} valueMax={yearMax} onMinChange={setYearMin} onMaxChange={setYearMax} />
              <div className="catalog-filter-block__range-inputs">
                <input
                  type="text"
                  className="catalog-filter-block__range-input"
                  value={yearMin}
                  onChange={(e) => setYearMin(e.target.value)}
                />
                <span className="catalog-filter-block__range-dash">–</span>
                <input
                  type="text"
                  className="catalog-filter-block__range-input"
                  value={yearMax}
                  onChange={(e) => setYearMax(e.target.value)}
                />
                <button className="catalog-filter-block__ok">OK</button>
              </div>
              </>)}
            </div>

            {/* Body type filter */}
            <div className="catalog-filter-block">
              <h3 className="catalog-filter-block__title" onClick={() => toggleFilter('body')}>
                КУЗОВ
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedFilters.body ? 'rotate(180deg)' : 'none' }}><path d="M18 15l-6-6-6 6"/></svg>
              </h3>
              {!collapsedFilters.body && (<>
              <div className="catalog-filter-block__search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Универсал"
                  value={bodySearch}
                  onChange={(e) => setBodySearch(e.target.value)}
                />
              </div>
              <div className="catalog-filter-block__options">
                {filteredBodyTypes.slice(0, showAllBodies ? undefined : 5).map(body => (
                  <label key={body.name} className="catalog-filter-block__checkbox">
                    <input
                      type="checkbox"
                      checked={selectedBodyTypes.includes(body.name)}
                      onChange={() => toggleBodyType(body.name)}
                    />
                    <span className="catalog-filter-block__check-mark" />
                    <span className="catalog-filter-block__label">{body.name}</span>
                    <span className="catalog-filter-block__count">{body.count}</span>
                  </label>
                ))}
              </div>
              {filteredBodyTypes.length > 5 && (
                <button className="catalog-filter-block__more" onClick={() => setShowAllBodies(!showAllBodies)}>
                  {showAllBodies ? 'Скрыть' : 'Показать больше'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d={showAllBodies ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"}/>
                  </svg>
                </button>
              )}
              </>)}
            </div>

            {/* Transmission filter */}
            <div className="catalog-filter-block">
              <h3 className="catalog-filter-block__title" onClick={() => toggleFilter('transmission')}>
                КОРОБКА ПЕРЕДАЧ
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedFilters.transmission ? 'rotate(180deg)' : 'none' }}><path d="M18 15l-6-6-6 6"/></svg>
              </h3>
              {!collapsedFilters.transmission && (
              <div className="catalog-filter-block__options">
                {(facets.transmissions || []).map(tr => (
                  <label key={tr.name} className="catalog-filter-block__checkbox">
                    <input
                      type="checkbox"
                      checked={selectedTransmissions.includes(tr.name)}
                      onChange={() => toggleTransmission(tr.name)}
                    />
                    <span className="catalog-filter-block__check-mark" />
                    <span className="catalog-filter-block__label">{tr.name}</span>
                    <span className="catalog-filter-block__count">{tr.count}</span>
                  </label>
                ))}
              </div>
              )}
            </div>

            {/* Fuel filter */}
            <div className="catalog-filter-block">
              <h3 className="catalog-filter-block__title" onClick={() => toggleFilter('fuel')}>
                ТОПЛИВО
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedFilters.fuel ? 'rotate(180deg)' : 'none' }}><path d="M18 15l-6-6-6 6"/></svg>
              </h3>
              {!collapsedFilters.fuel && (
              <div className="catalog-filter-block__options">
                {(facets.fuels || []).map(fuel => (
                  <label key={fuel.name} className="catalog-filter-block__checkbox">
                    <input
                      type="checkbox"
                      checked={selectedFuels.includes(fuel.name)}
                      onChange={() => toggleFuel(fuel.name)}
                    />
                    <span className="catalog-filter-block__check-mark" />
                    <span className="catalog-filter-block__label">{fuel.name}</span>
                    <span className="catalog-filter-block__count">{fuel.count}</span>
                  </label>
                ))}
              </div>
              )}
            </div>

            {/* Drive filter */}
            <div className="catalog-filter-block">
              <h3 className="catalog-filter-block__title" onClick={() => toggleFilter('drive')}>
                ПРИВОД
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedFilters.drive ? 'rotate(180deg)' : 'none' }}><path d="M18 15l-6-6-6 6"/></svg>
              </h3>
              {!collapsedFilters.drive && (
              <div className="catalog-filter-block__options">
                {(facets.drives || []).map(drive => (
                  <label key={drive.name} className="catalog-filter-block__checkbox">
                    <input
                      type="checkbox"
                      checked={selectedDrives.includes(drive.name)}
                      onChange={() => toggleDrive(drive.name)}
                    />
                    <span className="catalog-filter-block__check-mark" />
                    <span className="catalog-filter-block__label">{drive.name}</span>
                    <span className="catalog-filter-block__count">{drive.count}</span>
                  </label>
                ))}
              </div>
              )}
            </div>

            </div>{/* end sidebar-scroll */}
            <button className="catalog-page__sidebar-apply" onClick={() => setMobileFilterOpen(false)}>
              Показать {filteredCars.length} авто
            </button>
          </aside>

          {/* Car listings */}
          <div className={`catalog-page__listings catalog-page__listings--${viewMode}`}>
            {filteredCars.length === 0 && (
              <div className="catalog-page__empty">
                <p>По заданным фильтрам ничего не найдено</p>
              </div>
            )}
            {filteredCars.map(car => (
              <div key={car.id} className={`catalog-card catalog-card--${viewMode}`} onClick={() => navigate(`/catalog/${car.id}`)} style={{ cursor: 'pointer' }}>
                {/* Two images side by side */}
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

                {/* Info below images */}
                <div className="catalog-card__info">
                  {/* Row 1: name + price */}
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

                  {/* Tag specs row */}
                  <div className="catalog-card__tags-wrapper">
                    <button
                      className="catalog-card__tags-arrow catalog-card__tags-arrow--left"
                      onClick={(e) => {
                        e.stopPropagation();
                        const strip = e.currentTarget.parentElement.querySelector('.catalog-card__tags');
                        strip.scrollBy({ left: -200, behavior: 'smooth' });
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <div className="catalog-card__tags">
                      {Object.entries(car.tags).map(([key, value]) => (
                        <div key={key} className="catalog-card__tag">
                          <TagIcon type={key} />
                          <div className="catalog-card__tag-text">
                            <span className="catalog-card__tag-label">{tagLabels[key]}</span>
                            <span className="catalog-card__tag-value">{value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      className="catalog-card__tags-arrow catalog-card__tags-arrow--right"
                      onClick={(e) => {
                        e.stopPropagation();
                        const strip = e.currentTarget.parentElement.querySelector('.catalog-card__tags');
                        strip.scrollBy({ left: 200, behavior: 'smooth' });
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  </div>

                  {/* Bottom row */}
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
                            if (openMenuId === car.id) {
                              setOpenMenuId(null);
                            } else {
                              const rect = menuBtnRefs.current[car.id]?.getBoundingClientRect();
                              if (rect) {
                                setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                              }
                              setOpenMenuId(car.id);
                            }
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
            ))}
          </div>
        </div>
      </div>

      {/* Fixed popup for "Позвонить мне" */}
      {openMenuId !== null && (
        <>
          <div className="catalog-card__popup-overlay" onClick={() => setOpenMenuId(null)} />
          <div className="catalog-card__popup catalog-card__popup--fixed" style={{ top: menuPos.top, right: menuPos.right }}>
            <button className="catalog-card__popup-item" onClick={() => {
              const car = dbCars.find(c => c.id === openMenuId) || filteredCars.find(c => c.id === openMenuId);
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

      {noResultsOpen && (
        <NoResultsModal
          criteria={buildCriteriaText()}
          onClose={handleNoResultsClose}
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

      {/* Buy — contact modal (no phone) */}
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

      <Footer />
    </div>
  );
}

export default CatalogPage;
