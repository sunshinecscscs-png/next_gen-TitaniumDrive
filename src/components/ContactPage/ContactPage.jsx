import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitCallbackRequest } from '../../api/callbackRequests.js';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import './ContactPage.css';

function ContactPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+7');
  const [email, setEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePhoneChange = (e) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (!raw.startsWith('7')) raw = '7' + raw;
    if (raw.length <= 11) {
      const digits = raw;
      if (digits.length === 0) { setPhone(''); return; }
      let result = '+7';
      if (digits.length > 1) result += ' (' + digits.slice(1, 4);
      if (digits.length >= 4) result += ')';
      if (digits.length > 4) result += ' ' + digits.slice(4, 7);
      if (digits.length > 7) result += '-' + digits.slice(7, 9);
      if (digits.length > 9) result += '-' + digits.slice(9, 11);
      setPhone(result);
    }
  };

  const handlePhoneKeyDown = (e) => {
    // prevent deleting the "+7" prefix
    if ((e.key === 'Backspace' || e.key === 'Delete') && phone.length <= 2) {
      e.preventDefault();
    }
  };

  const phoneDigits = phone.replace(/\D/g, '');
  const isValid = name.trim().length >= 2 && phoneDigits.length === 11 && topic && message.trim().length >= 2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await submitCallbackRequest({
        type: 'question',
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        order_number: orderNumber.trim() || undefined,
        topic,
        message: message.trim(),
      });
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccess(false);
    setName('');
    setPhone('+7 ');
    setEmail('');
    setOrderNumber('');
    setTopic('');
    setMessage('');
  };

  return (
    <div className="contact-page">
      <Header
        forceScrolled
      />

      <div className="contact-page__body">
      {/* Breadcrumb */}
      <div className="contact-page__breadcrumb">
        <a href="/" className="contact-page__breadcrumb-link" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Главная</a>
        <span className="contact-page__breadcrumb-sep">/</span>
        <span>Связаться с нами</span>
      </div>

      <h1 className="contact-page__title">Связаться с нами</h1>

      <div className="contact-page__content">
        {/* Left column — info */}
        <div className="contact-page__info">
          <p className="contact-page__text">
            Команда TitaniumDrive нацелена на результат и продуктивную работу.
            Поэтому мы всегда на связи с нашими клиентами.
          </p>
          <p className="contact-page__text">
            Если у вас возникли проблемы с заказом, вы хотите поделиться
            предложениями относительно нашей работы — обратитесь к нам или
            заполните контактную форму. Наши менеджеры свяжутся с вами для
            решения вопросов.
          </p>

          <h3 className="contact-page__section-title">Контакты</h3>

          <div className="contact-page__contacts">
            <div className="contact-page__contact-item">
              <div className="contact-page__contact-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.86 19.86 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.86 19.86 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
              </div>
              <div>
                <a href="tel:+79820780996" style={{color:'inherit',textDecoration:'none'}}>8 (800) 505-51-99</a>
              </div>
            </div>

            <div className="contact-page__contact-item">
              <div className="contact-page__contact-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div>214032, Смоленская область, г Смоленск, ул Лавочкина, д. 106, помещ. 7</div>
            </div>

            <div className="contact-page__contact-item">
              <div className="contact-page__contact-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div><a href="mailto:contact.finteh.avto@gmail.com" style={{color:'inherit',textDecoration:'none'}}>contact.finteh.avto@gmail.com</a></div>
            </div>
          </div>

          <h3 className="contact-page__section-title">Мы в соцсетях</h3>
          <div className="contact-page__socials">
            <a href="https://t.me/TitaniumDrive" target="_blank" rel="noopener noreferrer" className="contact-page__social-icon" aria-label="Telegram">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </a>
            <a href="https://vk.com/dealerrugroup" target="_blank" rel="noopener noreferrer" className="contact-page__social-icon" aria-label="VK">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.547 7h-3.29a.743.743 0 00-.655.392s-1.312 2.416-1.734 3.23C14.734 12.813 14 12.126 14 11.11V7.603A1.104 1.104 0 0012.896 6.5h-2.474a1.982 1.982 0 00-1.75.813s1.255-.204 1.255 1.49c0 .42.022 1.626.04 2.64a.73.73 0 01-1.272.503 21.54 21.54 0 01-2.498-4.543.693.693 0 00-.63-.403H2.66a.742.742 0 00-.677 1.03c1.827 4.203 5.395 8.97 10.036 8.97h1.234a.742.742 0 00.742-.742v-1.135a.743.743 0 01.677-.742c.344-.029.663.18.803.49.577 1.284 1.084 2.13 1.084 2.13a.742.742 0 00.642.37h3.2a.743.743 0 00.666-1.073s-1.166-2.052-1.77-3.177a.741.741 0 01.078-.832C20.903 11.385 22.96 8.67 22.96 8.67A.745.745 0 0021.547 7z"/></svg>
            </a>
          </div>
        </div>

        {/* Right column — form */}
        <div className="contact-page__form-wrap">
          <h2 className="contact-page__form-title">Связаться с нашей командой</h2>

          {!success ? (
          <form className="contact-page__form" onSubmit={handleSubmit}>
            <div className="contact-page__form-row">
              <div className="contact-page__form-field">
                <label className="contact-page__form-label">Имя *</label>
                <input type="text" className="contact-page__form-input" placeholder="Введите имя" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="contact-page__form-field">
                <label className="contact-page__form-label">Номер телефона *</label>
                <input
                  type="tel"
                  className="contact-page__form-input"
                  placeholder="+7 (___) ___-__-__"
                  value={phone}
                  onChange={handlePhoneChange}
                  onKeyDown={handlePhoneKeyDown}
                />
              </div>
            </div>

            <div className="contact-page__form-row">
              <div className="contact-page__form-field">
                <label className="contact-page__form-label">E-mail</label>
                <input type="email" className="contact-page__form-input" placeholder="Введите e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="contact-page__form-field">
                <label className="contact-page__form-label">Номер заказа</label>
                <input type="text" className="contact-page__form-input" placeholder="Введите номер заказа" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
                <span className="contact-page__form-hint">Заполните это поле, если у вас есть вопрос относительно вашего заказа</span>
              </div>
            </div>

            <div className="contact-page__form-field contact-page__form-field--full">
              <label className="contact-page__form-label">Тема обращения *</label>
              <select className="contact-page__form-select" value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="" disabled>Выберите тему</option>
                <option value="Вопрос по заказу">Вопрос по заказу</option>
                <option value="Доставка">Доставка</option>
                <option value="Оплата">Оплата</option>
                <option value="Другое">Другое</option>
              </select>
            </div>

            <div className="contact-page__form-field contact-page__form-field--full">
              <label className="contact-page__form-label">Сообщение *</label>
              <textarea
                className="contact-page__form-textarea"
                placeholder="Напишите сообщение для нас"
                rows="6"
                maxLength="500"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              ></textarea>
              <span className="contact-page__form-counter">{message.length} / 500</span>
            </div>

            <p className="contact-page__form-disclaimer">
              Нажимая кнопку «Отправить» вы соглашаетесь с{' '}
              <a href="#">Правилами пользования</a> и{' '}
              <a href="#">Политикой конфиденциальности</a>
            </p>

            <button className="contact-page__form-submit" type="submit" disabled={!isValid || submitting}>
              {submitting ? 'Отправка...' : 'Отправить'}
            </button>
          </form>
          ) : (
          <div className="contact-page__success">
            <div className="contact-page__success-icon">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="28" fill="#111"/>
                <path d="M18 28.5L25 35.5L38 21.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="contact-page__success-title">Заявка отправлена!</h3>
            <p className="contact-page__success-text">
              Спасибо, {name}! Наш менеджер свяжется с вами в ближайшее время.
            </p>
            <button className="contact-page__form-submit" onClick={handleReset}>
              Отправить ещё
            </button>
          </div>
          )}
        </div>
      </div>
      </div>

      <Footer />
    </div>
  );
}

export default ContactPage;
