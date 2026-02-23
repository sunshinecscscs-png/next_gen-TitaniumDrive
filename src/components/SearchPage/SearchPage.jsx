import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import { fetchCars } from '../../api/cars';
import './SearchPage.css';

/* Build price ranges */
const priceRanges = [
  { label: 'до 2 000 000 ₽', min: 0, max: 2000000 },
  { label: '2 000 000 – 3 500 000 ₽', min: 2000000, max: 3500000 },
  { label: '3 500 000 – 5 000 000 ₽', min: 3500000, max: 5000000 },
  { label: '5 000 000 – 7 000 000 ₽', min: 5000000, max: 7000000 },
  { label: 'от 7 000 000 ₽', min: 7000000, max: 999999999 },
];

/* ── Custom Select dropdown ── */
function CustomSelect({ value, onChange, placeholder, options, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || '';

  return (
    <div className={`sp-select${open ? ' sp-select--open' : ''}${disabled ? ' sp-select--disabled' : ''}`} ref={ref}>
      <button
        type="button"
        className="sp-select__trigger"
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
      >
        <span className={`sp-select__value${!value ? ' sp-select__value--placeholder' : ''}`}>
          {selectedLabel || placeholder}
        </span>
        <svg className="sp-select__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div className="sp-select__dropdown">
          <div className="sp-select__list">
            <button
              type="button"
              className={`sp-select__option${!value ? ' sp-select__option--active' : ''}`}
              onClick={() => { onChange(''); setOpen(false); }}
            >
              {placeholder}
            </button>
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`sp-select__option${opt.value === value ? ' sp-select__option--active' : ''}`}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchPage({ onAuthOpen }) {
  const navigate = useNavigate();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [price, setPrice] = useState('');
  const [body, setBody] = useState('');
  const [dotCount, setDotCount] = useState(0);

  /* Facets from API */
  const [facets, setFacets] = useState({ brands: [], models: [], bodyTypes: [], total: 0 });
  const [matchCount, setMatchCount] = useState(null);

  /* Load facets on mount */
  useEffect(() => {
    fetch('/api/cars/stats/counts')
      .then(r => r.json())
      .then(data => {
        setFacets({
          brands: (data.brands || []).map(b => b.name),
          models: data.models || [],
          bodyTypes: (data.bodyTypes || []).map(b => b.name),
          total: data.total || 0,
        });
        setMatchCount(data.total || 0);
      })
      .catch(() => {});
  }, []);

  /* Count matching offers from API when filters change */
  const buildParams = useCallback(() => {
    const p = {};
    if (brand) p.brand = brand;
    if (model) p.model = model;
    if (body) p.body_type = body;
    if (price !== '') {
      const range = priceRanges[Number(price)];
      if (range) {
        p.price_min = range.min;
        if (range.max < 999999999) p.price_max = range.max;
      }
    }
    p.limit = 1; // only need total count
    return p;
  }, [brand, model, body, price]);

  useEffect(() => {
    const params = buildParams();
    fetchCars(params)
      .then(data => setMatchCount(data.total))
      .catch(() => {});
  }, [buildParams]);

  /* Animated dots for the heading */
  useEffect(() => {
    const timer = setInterval(() => {
      setDotCount(prev => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  /* Models for selected brand */
  const availableModels = brand
    ? facets.models
        .filter(m => m.name.toLowerCase().startsWith(brand.toLowerCase()))
        .map(m => ({ label: m.name, value: m.value }))
    : [];

  const displayCount = matchCount ?? facets.total;

  const handleSubmit = () => {
    const qs = new URLSearchParams();
    if (brand) qs.set('brand', brand);
    if (model) qs.set('model', model);
    if (body) qs.set('body_type', body);
    if (price !== '') {
      const range = priceRanges[Number(price)];
      if (range) {
        qs.set('price_min', range.min);
        if (range.max < 999999999) qs.set('price_max', range.max);
      }
    }
    navigate(`/catalog?${qs.toString()}`);
  };

  const dots = '.'.repeat(dotCount);
  const greyDots = '.'.repeat(3 - dotCount);

  /* Russian pluralization for "предложение" */
  const plural = (n) => {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return 'предложений';
    if (last === 1) return 'предложение';
    if (last >= 2 && last <= 4) return 'предложения';
    return 'предложений';
  };

  return (
    <div className="search-page">
      <Header forceScrolled onAuthOpen={onAuthOpen} />

      <div className="search-page__body">
        <h1 className="search-page__title">
          Авто моей мечты это{' '}
          <span className="search-page__dots-black">{dots}</span>
          <span className="search-page__dots-grey">{greyDots}</span>
        </h1>

        <div className="search-page__form">
          <div className="search-page__row">
            <div className="search-page__field">
              <CustomSelect
                value={brand}
                onChange={(v) => { setBrand(v); setModel(''); }}
                placeholder="Марка"
                options={facets.brands.map(b => ({ value: b, label: b }))}
              />
            </div>

            <div className="search-page__field">
              <CustomSelect
                value={model}
                onChange={setModel}
                placeholder="Модель"
                options={availableModels.map(m => ({ value: m.value, label: m.label }))}
                disabled={!brand}
              />
            </div>
          </div>

          <div className="search-page__row">
            <div className="search-page__field">
              <CustomSelect
                value={price}
                onChange={setPrice}
                placeholder="Цена"
                options={priceRanges.map((r, i) => ({ value: String(i), label: r.label }))}
              />
            </div>

            <div className="search-page__field">
              <CustomSelect
                value={body}
                onChange={setBody}
                placeholder="Кузов"
                options={facets.bodyTypes.map(b => ({ value: b, label: b }))}
              />
            </div>
          </div>

          <button className="search-page__submit" onClick={handleSubmit}>
            {displayCount} {plural(displayCount)}
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default SearchPage;
