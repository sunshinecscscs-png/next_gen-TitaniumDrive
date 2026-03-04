import { useState, useEffect } from 'react';
import { submitCallbackRequest } from '../../api/callbackRequests.js';
import { isMoscowWorkingHours } from '../../utils/workHours';
import './CallbackModal.css';

function CallbackModal({ onClose, carName, carId }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

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
        type: carId ? 'car' : 'simple',
        name: name.trim(),
        phone: phone.trim(),
        car_id: carId || undefined,
        car_name: carName || undefined,
      });
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setSuccess(true); // show success anyway for UX
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="callback-modal-overlay" onClick={onClose}>
      <div className="callback-modal" onClick={(e) => e.stopPropagation()}>

        {!success ? (
          <>
            <div className="callback-modal__header">
              <h2 className="callback-modal__title">Позвонить мне</h2>
              <button className="callback-modal__close" onClick={onClose} aria-label="Закрыть">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#222"/>
                  <path d="M6.5 6.5L13.5 13.5M13.5 6.5L6.5 13.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {carName && (
              <p className="callback-modal__car">Автомобиль: <strong>{carName}</strong></p>
            )}

            <form className="callback-modal__form" onSubmit={handleSubmit}>
              <div className="callback-modal__field">
                <label className="callback-modal__label">Как вас зовут? *</label>
                <input
                  type="text"
                  className="callback-modal__input"
                  placeholder="Введите ваше имя"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="callback-modal__field">
                <label className="callback-modal__label">Ваш контактный номер *</label>
                <input
                  type="tel"
                  className="callback-modal__input"
                  placeholder="+7 (___) ___ - __ - __"
                  value={phone}
                  onChange={handlePhoneChange}
                />
                <span className="callback-modal__hint">Мы принимаем только российские номера телефонов</span>
              </div>

              <button
                className={`callback-modal__submit ${isValid && !submitting ? '' : 'callback-modal__submit--disabled'}`}
                type="submit"
                disabled={!isValid || submitting}
              >
                {submitting ? 'Отправка...' : 'Оставить заявку'}
              </button>
            </form>
          </>
        ) : (
          <div className="callback-modal__success">
            <div className="callback-modal__success-icon">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <circle cx="28" cy="28" r="28" fill="#111"/>
                <path d="M18 28.5L25 35.5L38 21.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="callback-modal__success-title">Заявка отправлена!</h3>
            <p className="callback-modal__success-text">
              {isMoscowWorkingHours()
                ? <>Спасибо, {name}! Наш менеджер свяжется с вами по номеру <strong>{phone}</strong> в течение 10 минут.</>
                : <>Спасибо, {name}! Рабочий день уже завершён — менеджер свяжется с вами завтра по номеру <strong>{phone}</strong>.</>}
            </p>
            <button className="callback-modal__success-btn" onClick={onClose}>
              Отлично
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CallbackModal;
