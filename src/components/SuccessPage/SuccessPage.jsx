import { useNavigate } from 'react-router-dom';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import { isMoscowWorkingHours } from '../../utils/workHours';
import './SuccessPage.css';

export default function SuccessPage({ onAuthOpen }) {
  const navigate = useNavigate();

  return (
    <div className="success-page">
      <Header onAuthOpen={onAuthOpen} forceScrolled />

      <div className="success-page__content">
        <div className="success-page__card">
          <div className="success-page__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h1 className="success-page__title">Заявка отправлена!</h1>
          <p className="success-page__text">
            {isMoscowWorkingHours()
              ? 'Спасибо! Наш менеджер свяжется с вами в течение 10 минут.'
              : 'Спасибо! Рабочий день уже завершён — менеджер свяжется с вами завтра.'}
          </p>
          <button className="success-page__btn" onClick={() => navigate('/catalog')}>
            Вернуться в каталог
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
