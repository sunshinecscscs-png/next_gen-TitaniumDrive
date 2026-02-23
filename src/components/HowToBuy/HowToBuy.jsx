import { useState } from 'react';
import './HowToBuy.css';

const steps = [
  {
    id: 1,
    title: 'Осмотр и резерв автомобиля',
    text: 'Вы выбираете интересующий автомобиль, после чего наши специалисты предоставляют Акт технического осмотра. Если вы подтверждаете состояние машины, автомобиль резервируется под вас и исключается из каталога.',
    image: '/steps/Create_a_premium_202602192213.jpeg',
  },
  {
    id: 2,
    title: 'Таможенное оформление и подписание договора',
    text: 'Мы бронируем место на таможне, а в день подачи автомобиля заключается договор. Таможенный брокер подаёт декларацию напрямую на клиента, а все таможенные сборы оплачиваются официально через банк по договору.',
    image: '/steps/Image_202602192211.jpeg',
  },
  {
    id: 3,
    title: 'Доставка и проверка в Москве',
    text: 'Автомобиль доставляется автовозом до Москвы с транзитными номерами. На месте проводится финальная проверка технического состояния на соответствие акту осмотра.',
    image: '/steps/Create_a_premium_202602192212.jpeg',
  },
];

function HowToBuy() {
  const [activeStep, setActiveStep] = useState(0);
  const current = steps[activeStep];

  const handleNext = () => {
    setActiveStep((prev) => (prev + 1) % steps.length);
  };

  return (
    <section className="how-to-buy">
      <h2 className="how-to-buy__heading">
        Как купить авто на нашей платформе?
      </h2>

      <div className="how-to-buy__body">
        <div className="how-to-buy__left">
          <div className="how-to-buy__steps">
            {steps.map((step, index) => (
              <button
                key={step.id}
                className={`how-to-buy__bar ${index === activeStep ? 'how-to-buy__bar--active' : ''}`}
                onClick={() => setActiveStep(index)}
                aria-label={`Шаг ${step.id}`}
              >
                <span className="how-to-buy__bar-line"></span>
                {index === activeStep && (
                  <div className="how-to-buy__bar-content">
                    <span className="how-to-buy__step-label">Шаг {step.id}</span>
                    <h3 className="how-to-buy__step-title">{step.title}</h3>
                    <p className="how-to-buy__step-text">{step.text}</p>
                  </div>
                )}
              </button>
            ))}
          </div>

          <button className="how-to-buy__next" onClick={handleNext}>
            <span>Следующий шаг</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 6H11M11 6L6 1M11 6L6 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="how-to-buy__right">
          <div className="how-to-buy__images">
            <img
              src={current.image}
              alt={current.title}
              className="how-to-buy__img"
            />
          </div>
        </div>
      </div>

      <div className="how-to-buy__progress">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`how-to-buy__progress-seg ${i === activeStep ? 'how-to-buy__progress-seg--active' : ''}`}
            onClick={() => setActiveStep(i)}
          />
        ))}
      </div>
    </section>
  );
}

export default HowToBuy;
