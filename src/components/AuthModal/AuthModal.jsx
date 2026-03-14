import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { sendVerificationCode, verifyCodeAndRegister } from '../../api/auth.js';
import './AuthModal.css';

function AuthModal({ onClose }) {
  const { user, login, logout } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'code'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [codeTimer, setCodeTimer] = useState(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  /* Таймер повторной отправки кода */
  useEffect(() => {
    if (codeTimer <= 0) return;
    const t = setTimeout(() => setCodeTimer(codeTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [codeTimer]);

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

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPasswordValid = password.length >= 6;
  const isNameValid = name.trim().length >= 2;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email, password });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const phoneDigits = phone.replace(/\D/g, '');
      await sendVerificationCode({
        name,
        email,
        password,
        phone: phoneDigits ? `+7${phoneDigits}` : undefined,
      });
      setMode('code');
      setVerifyCode('');
      setCodeTimer(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await verifyCodeAndRegister({ email, code: verifyCode });
      localStorage.setItem('autosite_token', token);
      // обновляем контекст через register (он сохранит user)
      // но у нас уже есть token — можно просто перезагрузить
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setLoading(true);
    try {
      const phoneDigits = phone.replace(/\D/g, '');
      await sendVerificationCode({
        name,
        email,
        password,
        phone: phoneDigits ? `+7${phoneDigits}` : undefined,
      });
      setCodeTimer(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  /* ── Если уже авторизован — показываем профиль ── */
  if (user) {
    return (
      <div className="auth-modal-overlay" onClick={onClose}>
        <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
          <div className="auth-modal__header">
            <h2 className="auth-modal__title">Профиль</h2>
            <button className="auth-modal__close" onClick={onClose} aria-label="Закрыть">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="10" fill="#222"/>
                <path d="M6.5 6.5L13.5 13.5M13.5 6.5L6.5 13.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="auth-modal__profile">
            <div className="auth-modal__avatar">{user.name?.[0]?.toUpperCase() || 'U'}</div>
            <p className="auth-modal__profile-name">{user.name}</p>
            <p className="auth-modal__profile-email">{user.email}</p>
            {user.phone && <p className="auth-modal__profile-phone">{user.phone}</p>}
          </div>
          <div className="auth-modal__buttons" style={{ marginTop: 24 }}>
            <button className="auth-modal__btn auth-modal__btn--cancel" onClick={onClose}>Закрыть</button>
            <button className="auth-modal__btn auth-modal__btn--next auth-modal__btn--active auth-modal__btn--danger" onClick={handleLogout}>Выйти</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="auth-modal__header">
          <h2 className="auth-modal__title">
            {mode === 'login' && 'Вход'}
            {mode === 'register' && 'Регистрация'}
            {mode === 'code' && 'Код подтверждения'}
          </h2>
          <button className="auth-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="#222"/>
              <path d="M6.5 6.5L13.5 13.5M13.5 6.5L6.5 13.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Login form */}
        {mode === 'login' && (
          <form className="auth-modal__form" onSubmit={handleLogin}>
            {error && <span className="auth-modal__error">{error}</span>}

            <label className="auth-modal__label">Email</label>
            <input
              type="email"
              className="auth-modal__text-input"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />

            <label className="auth-modal__label" style={{ marginTop: 20 }}>Пароль</label>
            <div className="auth-modal__password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                className="auth-modal__password-input"
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="auth-modal__password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="Показать пароль">
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>

            <div className="auth-modal__buttons">
              <button type="button" className="auth-modal__btn auth-modal__btn--cancel" onClick={onClose}>
                Отменить
              </button>
              <button
                type="submit"
                className={`auth-modal__btn auth-modal__btn--next ${isEmailValid && isPasswordValid ? 'auth-modal__btn--active' : ''}`}
                disabled={!isEmailValid || !isPasswordValid || loading}
              >
                {loading ? 'Вход...' : 'Войти'}
              </button>
            </div>

            <p className="auth-modal__switch">
              Нет аккаунта?{' '}
              <button type="button" className="auth-modal__switch-link" onClick={() => { setMode('register'); setError(''); }}>
                Зарегистрируйтесь
              </button>
            </p>
          </form>
        )}

        {/* Register form */}
        {mode === 'register' && (
          <form className="auth-modal__form" onSubmit={handleRegister}>
            {error && <span className="auth-modal__error">{error}</span>}

            <label className="auth-modal__label">Ваше имя</label>
            <input
              type="text"
              className="auth-modal__text-input"
              placeholder="Введите имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />

            <label className="auth-modal__label" style={{ marginTop: 20 }}>Email</label>
            <input
              type="email"
              className="auth-modal__text-input"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="auth-modal__label" style={{ marginTop: 20 }}>Номер телефона (необязательно)</label>
            <div className="auth-modal__phone-row">
              <input
                type="tel"
                className="auth-modal__phone-input"
                placeholder="+7 / +375"
                value={phone}
                onChange={handlePhoneChange}
              />
            </div>

            <label className="auth-modal__label" style={{ marginTop: 20 }}>Пароль</label>
            <div className="auth-modal__password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                className="auth-modal__password-input"
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="auth-modal__password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="Показать пароль">
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>

            <label className="auth-modal__label" style={{ marginTop: 20 }}>Подтвердите пароль</label>
            <div className="auth-modal__password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                className="auth-modal__password-input"
                placeholder="Повторите пароль"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {confirmPassword && password !== confirmPassword && (
              <span className="auth-modal__error">Пароли не совпадают</span>
            )}

            <div className="auth-modal__buttons">
              <button type="button" className="auth-modal__btn auth-modal__btn--cancel" onClick={() => { setMode('login'); setError(''); }}>
                Назад
              </button>
              <button
                type="submit"
                className={`auth-modal__btn auth-modal__btn--next ${isEmailValid && isPasswordValid && isNameValid && password === confirmPassword ? 'auth-modal__btn--active' : ''}`}
                disabled={!isEmailValid || !isPasswordValid || !isNameValid || password !== confirmPassword || loading}
              >
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
            </div>

            <p className="auth-modal__switch">
              Уже есть аккаунт?{' '}
              <button type="button" className="auth-modal__switch-link" onClick={() => { setMode('login'); setError(''); }}>
                Войдите
              </button>
            </p>
          </form>
        )}

        {/* Code verification form */}
        {mode === 'code' && (
          <form className="auth-modal__form" onSubmit={handleVerify}>
            {error && <span className="auth-modal__error">{error}</span>}

            <p className="auth-modal__code-hint">
              Мы отправили 6-значный код на<br/>
              <strong>{email}</strong>
            </p>

            <label className="auth-modal__label">Код подтверждения</label>
            <input
              type="text"
              className="auth-modal__text-input auth-modal__code-input"
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              autoFocus
              style={{ fontSize: '24px', letterSpacing: '8px', textAlign: 'center' }}
            />

            <div className="auth-modal__buttons">
              <button type="button" className="auth-modal__btn auth-modal__btn--cancel" onClick={() => { setMode('register'); setError(''); }}>
                Назад
              </button>
              <button
                type="submit"
                className={`auth-modal__btn auth-modal__btn--next ${verifyCode.length === 6 ? 'auth-modal__btn--active' : ''}`}
                disabled={verifyCode.length !== 6 || loading}
              >
                {loading ? 'Проверка...' : 'Подтвердить'}
              </button>
            </div>

            <p className="auth-modal__switch">
              {codeTimer > 0 ? (
                <span style={{ color: '#999' }}>Отправить повторно через {codeTimer} сек</span>
              ) : (
                <button type="button" className="auth-modal__switch-link" onClick={handleResendCode} disabled={loading}>
                  Отправить код повторно
                </button>
              )}
            </p>
          </form>
        )}

        {/* Footer */}
        <div className="auth-modal__footer">
          Ознакомьтесь с{' '}
          <a href="#" className="auth-modal__footer-link">пользовательским соглашением</a>
          {' '}и{' '}
          <a href="#" className="auth-modal__footer-link">политикой конфиденциальности</a>
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
