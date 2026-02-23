import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import './WhyUsPage.css';

function WhyUsPage({ onAuthOpen }) {
  const navigate = useNavigate();
  const [ctaForm, setCtaForm] = useState(false);
  const [ctaName, setCtaName] = useState('');
  const [ctaPhone, setCtaPhone] = useState('+7 ');
  const [ctaSuccess, setCtaSuccess] = useState(false);

  const handleCtaPhone = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    let digits = raw;
    if (digits.startsWith('7')) digits = digits.slice(1);
    if (digits.startsWith('8')) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    let f = '+7 ';
    if (digits.length > 0) f += '(' + digits.slice(0, 3);
    if (digits.length >= 3) f += ') ';
    if (digits.length > 3) f += digits.slice(3, 6);
    if (digits.length >= 6) f += ' - ';
    if (digits.length > 6) f += digits.slice(6, 8);
    if (digits.length >= 8) f += ' - ';
    if (digits.length > 8) f += digits.slice(8, 10);
    setCtaPhone(f);
  };

  const handleCtaSubmit = (e) => {
    e.preventDefault();
    const digits = ctaPhone.replace(/\D/g, '');
    if (!ctaName.trim() || digits.length < 11) return;
    setCtaSuccess(true);
    setTimeout(() => { setCtaForm(false); setCtaSuccess(false); setCtaName(''); setCtaPhone('+7 '); }, 3000);
  };

  return (
    <div className="whyus-page">
      <Header
        forceScrolled
        onAuthOpen={onAuthOpen}
      />

      <div className="whyus-page__body">
        {/* Breadcrumb */}
        <div className="whyus-page__breadcrumb">
          <a href="/" className="whyus-page__breadcrumb-link" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Главная</a>
          <span className="whyus-page__breadcrumb-sep">/</span>
          <span>Про нас</span>
        </div>

        <h1 className="whyus-page__title">Про нас</h1>

        {/* About section — dark, matching site style */}
        <section className="whyus-page__about">
          <div className="whyus-page__about-inner">
            <div className="whyus-page__about-left">
              <h2 className="whyus-page__about-heading">О компании</h2>
            </div>
            <div className="whyus-page__about-right">
              <p className="whyus-page__about-text">
                Мы благодарим вас за интерес к сотрудничеству! Наша компания уже много лет работает на рынке поставки автомобилей, выстроив прозрачную и юридически корректную схему работы. Мы сопровождаем клиента на каждом этапе — от выбора автомобиля до его постановки на учёт в России.
              </p>
              <h4 className="whyus-page__about-subtitle">Наши услуги:</h4>
              <ul className="whyus-page__about-list">
                <li>Выкуп автомобилей напрямую у собственников, без аукционов</li>
                <li>Полная проверка состояния авто перед покупкой: техническая диагностика, эндоскопия двигателя, проверка ЛКП и трансмиссии</li>
                <li>Таможенное оформление автомобилей на клиента с прозрачными расчетами</li>
                <li>Организация доставки автомобилей до Москвы и в регионы РФ автовозами</li>
                <li>Сопровождение сделки: заключение договора, проверка документов, оформление СБКТС</li>
                <li>Возможность рассрочки</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Why Us section — advantages */}
        <section className="whyus-page__advantages">
          <h2 className="whyus-page__section-heading">Почему мы?</h2>
          <p className="whyus-page__section-sub">
            У нас большой опыт в проверке и доставке авто из Германии, Италии,
            Бельгии, Франции, Нидерландов и других стран Западной Европы. Мы знаем
            как сохранить деньги и купить качественный автомобиль.
          </p>

          <div className="whyus-page__grid">
            <div className="whyus-page__card">
              <div className="whyus-page__card-num">01</div>
              <h3 className="whyus-page__card-title">Договор</h3>
              <p className="whyus-page__card-text">Мы заключаем официальный договор. Все условия фиксируются до начала работы.</p>
            </div>

            <div className="whyus-page__card">
              <div className="whyus-page__card-num">02</div>
              <h3 className="whyus-page__card-title">Точные сроки</h3>
              <p className="whyus-page__card-text">Работаем в соответствии с оговоренными в договоре сроками.</p>
            </div>

            <div className="whyus-page__card">
              <div className="whyus-page__card-num">03</div>
              <h3 className="whyus-page__card-title">Доставка из Европы</h3>
              <p className="whyus-page__card-text">Пригон автомобилей из таких стран как Бельгия, Италия, Германия и&nbsp;др.</p>
            </div>

            <div className="whyus-page__card">
              <div className="whyus-page__card-num">04</div>
              <h3 className="whyus-page__card-title">Выгодная цена</h3>
              <p className="whyus-page__card-text">Цена наших услуг 70&nbsp;000 руб. Перед оплатой составляем договор и работаем исключительно по нему.</p>
            </div>

            <div className="whyus-page__card">
              <div className="whyus-page__card-num">05</div>
              <h3 className="whyus-page__card-title">Проверка авто</h3>
              <p className="whyus-page__card-text">Проверка продавца и полной истории авто перед покупкой.</p>
            </div>

            <div className="whyus-page__card">
              <div className="whyus-page__card-num">06</div>
              <h3 className="whyus-page__card-title">Авто по параметрам</h3>
              <p className="whyus-page__card-text">Вы получите автомобиль с выбранными Вами характеристиками.</p>
            </div>

            <div className="whyus-page__card whyus-page__card--wide">
              <div className="whyus-page__card-num">07</div>
              <h3 className="whyus-page__card-title">Оформление авто</h3>
              <p className="whyus-page__card-text">Самостоятельно занимаемся таможенным оформлением и помогаем с постановкой на учёт в ГИБДД.</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="whyus-page__cta">
          <h2 className="whyus-page__cta-title">Готовы выбрать автомобиль?</h2>
          <p className="whyus-page__cta-text">Откройте каталог и найдите идеальный вариант прямо сейчас</p>

          {!ctaForm ? (
            <div className="whyus-page__cta-buttons">
              <button className="whyus-page__cta-btn whyus-page__cta-btn--primary" onClick={() => navigate('/catalog')}>Открыть каталог</button>
              <button className="whyus-page__cta-btn whyus-page__cta-btn--outline" onClick={() => setCtaForm(true)}>Связаться с нами</button>
            </div>
          ) : ctaSuccess ? (
            <div className="whyus-page__cta-success">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="23" stroke="#4caf50" strokeWidth="2"/>
                <path d="M14 24l7 7 13-13" stroke="#4caf50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p>Спасибо! Мы свяжемся с вами в ближайшее время.</p>
            </div>
          ) : (
            <form className="whyus-page__cta-form" onSubmit={handleCtaSubmit}>
              <input
                type="text"
                className="whyus-page__cta-input"
                placeholder="Ваше имя"
                value={ctaName}
                onChange={(e) => setCtaName(e.target.value)}
              />
              <input
                type="tel"
                className="whyus-page__cta-input"
                placeholder="+7 (___) ___ - __ - __"
                value={ctaPhone}
                onChange={handleCtaPhone}
                onKeyDown={(e) => { if ((e.key === 'Backspace' || e.key === 'Delete') && ctaPhone.length <= 3) e.preventDefault(); }}
              />
              <button type="submit" className="whyus-page__cta-btn whyus-page__cta-btn--primary">Отправить</button>
              <button type="button" className="whyus-page__cta-btn whyus-page__cta-btn--outline" onClick={() => setCtaForm(false)}>Отмена</button>
            </form>
          )}
        </section>
      </div>

      <Footer />
    </div>
  );
}

export default WhyUsPage;
