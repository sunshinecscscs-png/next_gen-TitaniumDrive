import { useState, useEffect, useRef } from 'react';
import { submitCallbackRequest } from '../../api/callbackRequests.js';
import './QuizWidget.css';

const STEPS = [
  {
    title: 'Что вас интересует?',
    type: 'radio',
    options: [
      'Легковой автомобиль',
      'Кроссовер / внедорожник',
      'Электромобиль',
      'Микроавтобус',
      'Коммерческий транспорт',
      'Спецтехника',
      'Пока не определился',
    ],
  },
  {
    title: 'Опишите марку, модель, год выпуска, пробег, пожелания по комплектации.',
    type: 'textarea',
    placeholder: 'Пример: BMW 530 2020, бензин, пробег до 100 000 км, черный, кожаный салон',
  },
  {
    title: 'Какой возраст автомобиля вас устраивает?',
    type: 'radio',
    options: [
      'Новый (до 1 года)',
      'До 3 лет',
      '3–5 лет',
      '5–7 лет',
      'Старше 7 лет',
      'Не имеет значения',
    ],
  },
  {
    title: 'Какой у вас ориентировочный бюджет на покупку?',
    type: 'radio',
    options: [
      'До 1 млн ₽',
      '1–1.5 млн ₽',
      '1.5–2 млн ₽',
      '2–3 млн ₽',
      'Более 3 млн ₽',
      'Хочу узнать, сколько стоит',
    ],
  },
  {
    title: 'Когда планируете покупку?',
    type: 'radio',
    options: [
      'Как можно скорее',
      'Через 1–3 месяца',
      'В течение месяца',
      'Пока просто интересуюсь',
    ],
  },
  {
    title: 'final',
    type: 'form',
  },
];

export default function QuizWidget() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const autoOpened = useRef(false);

  /* Auto-open after 3 seconds (once) */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!autoOpened.current) {
        autoOpened.current = true;
        setOpen(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const currentStep = STEPS[step];
  const totalSteps = STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;

  const canProceed = () => {
    if (!currentStep) return false;
    if (currentStep.type === 'radio') return !!answers[step];
    if (currentStep.type === 'textarea') return !!(answers[step] && answers[step].trim());
    if (currentStep.type === 'form') return name.trim() && phone.replace(/\D/g, '').length === 11;
    return false;
  };

  const handleSelect = (value) => {
    setAnswers((prev) => ({ ...prev, [step]: value }));
  };

  const handleTextChange = (e) => {
    setAnswers((prev) => ({ ...prev, [step]: e.target.value }));
  };

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    // Normalize: treat leading 8 or 7 as country code
    const d = digits.startsWith('7') || digits.startsWith('8') ? digits.slice(1) : digits;
    let formatted = '+7';
    if (d.length > 0) formatted += ' (' + d.slice(0, 3);
    if (d.length >= 3) formatted += ') ';
    if (d.length > 3) formatted += d.slice(3, 6);
    if (d.length >= 6) formatted += '-';
    if (d.length > 6) formatted += d.slice(6, 8);
    if (d.length >= 8) formatted += '-';
    if (d.length > 8) formatted += d.slice(8, 10);
    setPhone(formatted);
  };

  const buildMessage = () => {
    const parts = [];
    for (let i = 0; i < STEPS.length - 1; i++) {
      if (answers[i] !== undefined && answers[i] !== '') {
        parts.push(`${STEPS[i].title}\n→ ${answers[i]}`);
      }
    }
    return parts.join('\n\n');
  };

  const handleSubmit = async () => {
    if (sending) return;
    setSending(true);
    try {
      await submitCallbackRequest({
        type: 'quiz',
        name: name.trim(),
        phone: phone.trim(),
        message: buildMessage(),
      });
      setSubmitted(true);
    } catch {
      alert('Ошибка при отправке. Попробуйте ещё раз.');
    } finally {
      setSending(false);
    }
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else if (currentStep.type === 'form') {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  /* ── Submitted screen ── */
  if (submitted && open) {
    return (
      <>
        <div className="quiz-widget-window">
          <div className="quiz-widget-submitted">
            <span className="quiz-widget-submitted__icon">✅</span>
            <h3 className="quiz-widget-submitted__title">Заявка отправлена!</h3>
            <p className="quiz-widget-submitted__text">Мы свяжемся с вами в ближайшее время.</p>
          </div>
        </div>
        <button className={`quiz-fab${open ? ' quiz-fab--hidden' : ''}`} onClick={handleToggle} aria-label="Подбор авто">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
        </button>
      </>
    );
  }

  return (
    <>
      {open && (
        <div className="quiz-widget-window">
          {/* Header */}
          <div className="quiz-widget-header">
            <span className="quiz-widget-header__title">Подбор автомобиля</span>
            <button className="quiz-widget-header__close" onClick={() => setOpen(false)} aria-label="Закрыть">✕</button>
          </div>

          {/* Progress bar */}
          <div className="quiz-widget-progress">
            <div className="quiz-widget-progress__bar" style={{ width: `${progress}%` }} />
          </div>

          {/* Body */}
          <div className="quiz-widget-body">
            {currentStep.type === 'radio' && (
              <>
                <h3 className="quiz-widget-question">{currentStep.title}</h3>
                <div className="quiz-widget-options">
                  {currentStep.options.map((opt) => (
                    <label key={opt} className={`quiz-widget-option${answers[step] === opt ? ' quiz-widget-option--active' : ''}`}>
                      <span className={`quiz-widget-radio${answers[step] === opt ? ' quiz-widget-radio--checked' : ''}`} />
                      <span className="quiz-widget-option__text">{opt}</span>
                      <input type="radio" name={`quiz-step-${step}`} value={opt} checked={answers[step] === opt} onChange={() => handleSelect(opt)} className="quiz-widget-option__input" />
                    </label>
                  ))}
                </div>
              </>
            )}

            {currentStep.type === 'textarea' && (
              <>
                <h3 className="quiz-widget-question">{currentStep.title}</h3>
                <textarea
                  className="quiz-widget-textarea"
                  placeholder={currentStep.placeholder}
                  value={answers[step] || ''}
                  onChange={handleTextChange}
                />
              </>
            )}

            {currentStep.type === 'form' && (
              <div className="quiz-widget-final">
                <h3 className="quiz-widget-final__title">
                  Осталось заполнить форму ниже, <span className="quiz-widget-final__accent">чтобы забрать бонус</span>
                </h3>
                <p className="quiz-widget-final__subtitle">+ мы закрепим их именно за этим номером телефона!</p>
                <div className="quiz-widget-final__bonus">
                  <span>🎁</span>
                  <span>Скидка 15 000 руб.</span>
                </div>
                <input
                  type="text"
                  className="quiz-widget-input"
                  placeholder="Имя"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  type="tel"
                  className="quiz-widget-input"
                  placeholder="+7 (___) ___-__-__"
                  value={phone}
                  onChange={handlePhoneChange}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="quiz-widget-footer">
            {step > 0 && (
              <button className="quiz-widget-btn quiz-widget-btn--back" onClick={handleBack}>← Назад</button>
            )}
            <button
              className="quiz-widget-btn quiz-widget-btn--next"
              disabled={!canProceed() || sending}
              onClick={handleNext}
            >
              {currentStep.type === 'form' ? (sending ? 'Отправка...' : 'Отправить') : 'Далее →'}
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button className={`quiz-fab${open ? ' quiz-fab--hidden' : ''}`} onClick={handleToggle} aria-label="Подбор авто">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 14l2 2 4-4" />
        </svg>
      </button>
    </>
  );
}
