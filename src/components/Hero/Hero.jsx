import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Hero.css';

const backgrounds = [
  '/foni/intro-1.webp',
  '/foni/intro-4.webp',
  '/foni/af78ae7f-e5aa-4792-8ec5-2feace07654f.png',
  '/foni/bb0a4ca6-8fda-4b5a-8935-29818c11cbfa.png',
  '/foni/e0a22e22-ac4f-4807-8c9f-6a61f1b268fd.png',
  '/foni/f209c581-246f-4cef-a26d-ddb3224d7c26.png',
];

const SLIDE_DURATION = 8000;

function Hero() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState(true);
  const startTimeRef = useRef(Date.now());
  const rafRef = useRef(null);
  const [totalCars, setTotalCars] = useState(null);

  /* Fetch total car count from backend */
  useEffect(() => {
    fetch('/api/cars/stats/counts')
      .then(r => r.json())
      .then(data => setTotalCars(data.total || 0))
      .catch(() => {});
  }, []);

  const goToSlide = useCallback((index) => {
    setFade(false);
    setTimeout(() => {
      setCurrent(index);
      setFade(true);
      startTimeRef.current = Date.now();
    }, 600);
  }, []);

  useEffect(() => {
    startTimeRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min(elapsed / SLIDE_DURATION, 1);

      if (p >= 1) {
        goToSlide((current + 1) % backgrounds.length);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [current, goToSlide]);

  return (
    <section className="hero">
      <div className="hero__bg">
        <img
          src={backgrounds[current]}
          alt="Автомобиль"
          className={`hero__bg-image ${fade ? 'hero__bg-image--visible' : 'hero__bg-image--hidden'}`}
        />
        <div className="hero__overlay"></div>
      </div>

      <div className="hero__content">
        <div className="hero__accent-line"></div>
        <h1 className="hero__title">
          Пригоняем авто из Европы под ключ<br />
          <span className="hero__title-highlight">и берём на себя все этапы сделки</span>
        </h1>
        <p className="hero__subtitle">
          Подберём автомобиль на аукционах, согласуем торг, оформим документы,
          проверим техническое состояние и доставим в вашу страну без скрытых платежей.
        </p>

        {/* Mobile-only standalone car photo */}
        <div className="hero__photo">
          <img
            src={backgrounds[current]}
            alt="Автомобиль"
            className={`hero__photo-img ${fade ? 'hero__photo-img--visible' : 'hero__photo-img--hidden'}`}
          />
        </div>

        {/* Mobile slide progress bar */}
        <div className="hero__progress">
          {backgrounds.map((_, i) => (
            <div
              key={i}
              className={`hero__progress-segment${i === current ? ' hero__progress-segment--active' : ''}`}
            />
          ))}
        </div>

        <div className="hero__buttons">
          <button className="hero__btn hero__btn--filled" onClick={() => navigate('/catalog')}>
            Каталог
          </button>
          <button className="hero__btn hero__btn--outline" onClick={() => navigate('/search')}>
            Подобрать авто
          </button>
        </div>
      </div>

      <div className="hero__scroll-indicator">
        <div className="hero__scroll-dot"></div>
      </div>
    </section>
  );
}

export default Hero;
