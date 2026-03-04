import { useState } from 'react';
import { submitCallbackRequest } from '../../api/callbackRequests.js';
import { isMoscowWorkingHours } from '../../utils/workHours';
import './SearchSection.css';

function SearchSection() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    let result = '+7';
    if (digits.length > 1) result += ' (' + digits.slice(1, 4);
    if (digits.length >= 4) result += ')';
    if (digits.length > 4) result += ' ' + digits.slice(4, 7);
    if (digits.length > 7) result += '-' + digits.slice(7, 9);
    if (digits.length > 9) result += '-' + digits.slice(9, 11);
    return result;
  };

  const handlePhoneChange = (e) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (!raw.startsWith('7')) raw = '7' + raw;
    if (raw.length <= 11) {
      setPhone(formatPhone(raw));
    }
  };

  const phoneDigits = phone.replace(/\D/g, '');
  const isValid = name.trim().length >= 2 && phoneDigits.length === 11;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await submitCallbackRequest({
        type: 'simple',
        name: name.trim(),
        phone: phone.trim(),
      });
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setName('');
    setPhone('');
  };

  return (
    <section className="search-section">
      <div className="search-section__inner">
        <h2 className="search-section__title">
          Индивидуальный автоподбор
        </h2>

        <form className="search-section__form" onSubmit={handleSubmit}>
          <div className="search-section__field">
            <label className="search-section__label">Как вас зовут? *</label>
            <input
              type="text"
              className="search-section__input"
              placeholder="Введите ваше имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="search-section__field">
            <label className="search-section__label">Ваш контактный номер *</label>
            <input
              type="tel"
              className="search-section__input"
              placeholder="+7 (___) ___ - __ - __"
              value={phone}
              onChange={handlePhoneChange}
            />
            <span className="search-section__hint">Мы принимаем только российские номера телефонов</span>
          </div>

          <button
            className={`search-section__submit ${isValid && !submitting ? '' : 'search-section__submit--disabled'}`}
            type="submit"
            disabled={!isValid || submitting}
          >
            {submitting ? 'Отправка...' : 'Оставить заявку'}
          </button>
        </form>
      </div>

      {/* Success overlay */}
      {success && (
        <div className="search-success-overlay" onClick={handleClose}>
          <div className="search-success" onClick={(e) => e.stopPropagation()}>
            <div className="search-success__icon">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="28" fill="#111"/>
                <path d="M18 28.5L25 35.5L38 21.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="search-success__title">Заявка отправлена!</h3>
            <p className="search-success__text">
              {isMoscowWorkingHours()
                ? <>Спасибо, {name}! Наш менеджер свяжется с вами по номеру <strong>{phone}</strong> в течение 10 минут.</>
                : <>Спасибо, {name}! Рабочий день уже завершён — менеджер свяжется с вами завтра по номеру <strong>{phone}</strong>.</>}
            </p>
            <button className="search-success__btn" onClick={handleClose}>
              Отлично
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default SearchSection;
