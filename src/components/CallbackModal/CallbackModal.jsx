import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitCallbackRequest } from '../../api/callbackRequests.js';
import './CallbackModal.css';

function CallbackModal({ onClose, carName, carId }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.startsWith('375')) {
      let result = '+375';
      if (digits.length > 3) result += ' (' + digits.slice(3, 5);
      if (digits.length >= 5) result += ')';
      if (digits.length > 5) result += ' ' + digits.slice(5, 8);
      if (digits.length > 8) result += '-' + digits.slice(8, 10);
      if (digits.length > 10) result += '-' + digits.slice(10, 12);
      return result;
    }
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
    if (raw.startsWith('375')) {
      if (raw.length <= 12) setPhone(formatPhone(raw));
    } else {
      if (!raw.startsWith('7')) raw = '7' + raw;
      if (raw.length <= 11) setPhone(formatPhone(raw));
    }
  };

  const phoneDigits = phone.replace(/\D/g, '');
  const isValid = name.trim().length >= 2 && (phoneDigits.length === 11 || (phoneDigits.startsWith('375') && phoneDigits.length === 12));

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
      onClose();
      navigate('/success');
    } catch (err) {
      console.error(err);
      onClose();
      navigate('/success');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="callback-modal-overlay" onClick={onClose}>
      <div className="callback-modal" onClick={(e) => e.stopPropagation()}>
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
                  placeholder="+7 / +375"
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
      </div>
    </div>
  );
}

export default CallbackModal;
