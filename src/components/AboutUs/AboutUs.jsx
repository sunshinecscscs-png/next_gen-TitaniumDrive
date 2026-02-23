import { useNavigate } from 'react-router-dom';
import './AboutUs.css';

function AboutUs() {
  const navigate = useNavigate();
  return (
    <section className="about-us">
      <div className="about-us__inner">
        <div className="about-us__left">
          <h2 className="about-us__title">Про нас</h2>
        </div>
        <div className="about-us__right">
          <p className="about-us__text">
            Мы благодарим вас за интерес к сотрудничеству! Наша компания уже много лет работает на рынке поставки автомобилей, выстроив прозрачную и юридически корректную схему работы. Мы сопровождаем клиента на каждом этапе — от выбора автомобиля до его постановки на учёт в России.
          </p>
          <h4 className="about-us__subtitle">Наши услуги:</h4>
          <ul className="about-us__list">
            <li>Выкуп автомобилей напрямую у собственников, без аукционов</li>
            <li>Полная проверка состояния авто перед покупкой: техническая диагностика, эндоскопия двигателя, проверка ЛКП и трансмиссии</li>
            <li>Таможенное оформление автомобилей на клиента с прозрачными расчетами</li>
            <li>Организация доставки автомобилей до Москвы и в регионы РФ автовозами</li>
            <li>Сопровождение сделки: заключение договора, проверка документов, оформление СБКТС</li>
            <li>Возможность рассрочки</li>
          </ul>
          <button className="about-us__btn" onClick={() => navigate('/about')}>Узнать больше</button>
        </div>
      </div>
    </section>
  );
}

export default AboutUs;
