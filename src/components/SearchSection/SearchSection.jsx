import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitCallbackRequest } from '../../api/callbackRequests.js';
import './SearchSection.css';

function SearchSection() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        type: 'simple',
        name: name.trim(),
        phone: phone.trim(),
      });
      navigate('/success');
    } catch (err) {
      console.error(err);
      navigate('/success');
    } finally {
      setSubmitting(false);
    }
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
              placeholder="+7 / +375"
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
    </section>
  );
}

export default SearchSection;
