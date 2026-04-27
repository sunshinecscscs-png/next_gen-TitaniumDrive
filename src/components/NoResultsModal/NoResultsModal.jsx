import { useState, useEffect } from 'react';
import { submitCallbackRequest } from '../../api/callbackRequests.js';
import { handlePhoneInput } from '../../utils/phoneFormat.js';
import './NoResultsModal.css';

function NoResultsModal({ onClose, criteria }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const phoneDigits = phone.replace(/\D/g, '');
  const isValid = name.trim().length >= 2 && phoneDigits.length === 11;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await submitCallbackRequest({
        type: 'search_no_match',
        name: name.trim(),
        phone: phone.trim(),
        message: criteria || '',
      });
      setDone(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      console.error(err);
      setDone(true);
      setTimeout(onClose, 1800);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="no-results-modal-overlay" onClick={onClose}>
      <div className="no-results-modal" onClick={(e) => e.stopPropagation()}>
        <button className="no-results-modal__close" onClick={onClose} aria-label="Закрыть">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="10" fill="#222"/>
            <path d="M6.5 6.5L13.5 13.5M13.5 6.5L6.5 13.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {done ? (
          <div className="no-results-modal__success">
            <div className="no-results-modal__success-icon">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <path d="M22 4L12 14.01l-3-3"/>
              </svg>
            </div>
            <h3 className="no-results-modal__title">Заявка отправлена!</h3>
            <p className="no-results-modal__text">Менеджер подберёт варианты под ваш запрос и свяжется с вами в ближайшее время.</p>
          </div>
        ) : (
          <>
            <div className="no-results-modal__icon">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
            </div>
            <h3 className="no-results-modal__title">Не нашли подходящий автомобиль?</h3>
            <p className="no-results-modal__text">
              Оставьте заявку — менеджер подберёт варианты под ваш запрос и предложит авто, которые ещё не появились в каталоге.
            </p>

            {criteria && (
              <div className="no-results-modal__criteria">
                <span className="no-results-modal__criteria-label">Ваш запрос:</span>
                <span className="no-results-modal__criteria-value">{criteria}</span>
              </div>
            )}

            <form className="no-results-modal__form" onSubmit={handleSubmit}>
              <input
                className="no-results-modal__input"
                type="text"
                placeholder="Ваше имя *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <input
                className="no-results-modal__input"
                type="tel"
                placeholder="+7 (___) ___-__-__ *"
                value={phone}
                onChange={handlePhoneInput(setPhone)}
              />
              <button
                className={`no-results-modal__submit${isValid && !submitting ? '' : ' no-results-modal__submit--disabled'}`}
                type="submit"
                disabled={!isValid || submitting}
              >
                {submitting ? 'Отправка...' : 'Подобрать автомобиль'}
              </button>
            </form>

            <p className="no-results-modal__privacy">
              Нажимая кнопку, вы соглашаетесь с обработкой персональных данных
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default NoResultsModal;
