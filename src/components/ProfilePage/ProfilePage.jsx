import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { fetchProfile, updateProfile, updatePassword } from '../../api/profile.js';
import { handlePhoneInput } from '../../utils/phoneFormat.js';
import Header from '../Header/Header';
import Footer from '../Footer/Footer';
import './ProfilePage.css';

/* ── Reusable collapsible section ── */
function Section({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="profile-section">
      <div className="profile-section__header" onClick={() => setOpen(!open)}>
        <span className="profile-section__title">{title}</span>
        <svg className={`profile-section__chevron ${open ? 'profile-section__chevron--open' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && <div className="profile-section__body">{children}</div>}
    </div>
  );
}

/* ── Row ── */
function Row({ label, value, onEdit, onAdd }) {
  const empty = !value;
  return (
    <div className="profile-row">
      <span className="profile-row__label">{label}</span>
      <span className={`profile-row__value ${empty ? 'profile-row__value--empty' : ''}`}>
        {value || 'Не указано'}
      </span>
      {onEdit && !empty && (
        <button className="profile-row__action" onClick={onEdit} aria-label="Редактировать">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      )}
      {onAdd && empty && (
        <button className="profile-row__action" onClick={onAdd} aria-label="Добавить">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      )}
    </div>
  );
}

/* ── Format date for display ── */
function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

const genderMap = { male: 'Мужской', female: 'Женский' };

/* ══════════════════════════════════════ */
function ProfilePage({ onAuthOpen }) {
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  /* Edit modals */
  const [editModal, setEditModal] = useState(null); // 'contact' | 'personal' | 'password' | null
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!authUser) { setLoading(false); return; }
    fetchProfile()
      .then(({ user }) => setProfile(user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authUser]);

  /* ── Open edit dialog ── */
  const openContactEdit = () => {
    setForm({ phone: profile?.phone || '', email: profile?.email || '', address: profile?.address || '' });
    setError(''); setSuccess('');
    setEditModal('contact');
  };

  const openPersonalEdit = () => {
    setForm({
      name: profile?.name || '',
      surname: profile?.surname || '',
      patronymic: profile?.patronymic || '',
      birth_date: profile?.birth_date ? profile.birth_date.slice(0, 10) : '',
      gender: profile?.gender || '',
    });
    setError(''); setSuccess('');
    setEditModal('personal');
  };

  const openPasswordEdit = () => {
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setError(''); setSuccess('');
    setEditModal('password');
  };

  /* ── Save handlers ── */
  const saveContact = async () => {
    setSaving(true); setError('');
    try {
      const { user } = await updateProfile({ phone: form.phone, address: form.address });
      setProfile(user);
      setEditModal(null);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const savePersonal = async () => {
    setSaving(true); setError('');
    try {
      const { user } = await updateProfile({
        name: form.name,
        surname: form.surname,
        patronymic: form.patronymic,
        birth_date: form.birth_date || null,
        gender: form.gender || null,
      });
      setProfile(user);
      setEditModal(null);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const savePassword = async () => {
    if (form.newPassword !== form.confirmPassword) {
      setError('Пароли не совпадают'); return;
    }
    setSaving(true); setError('');
    try {
      await updatePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setSuccess('Пароль успешно обновлён');
      setTimeout(() => setEditModal(null), 1200);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  /* ── Not authenticated ── */
  if (!authUser) {
    return (
      <>
        <Header forceScrolled onAuthOpen={onAuthOpen} />
        <div className="profile-page">
          <div className="profile-page__inner">
            <p style={{ textAlign: 'center', color: '#999', padding: '80px 0' }}>Войдите в аккаунт, чтобы открыть профиль.</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Header forceScrolled onAuthOpen={onAuthOpen} />
        <div className="profile-page">
          <div className="profile-page__inner" style={{ textAlign: 'center', padding: '80px 0', color: '#999' }}>Загрузка...</div>
        </div>
        <Footer />
      </>
    );
  }

  const p = profile || {};
  const fullName = [p.surname, p.name, p.patronymic].filter(Boolean).join(' ') || p.name || '';

  return (
    <>
      <Header forceScrolled onAuthOpen={onAuthOpen} />
      <div className="profile-page">
        <div className="profile-page__inner">

          {/* Breadcrumb */}
          <nav className="profile-page__breadcrumb">
            <a href="/" className="profile-page__breadcrumb-link" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Главная</a>
            <span className="profile-page__breadcrumb-sep">/</span>
            <a href="/cabinet" className="profile-page__breadcrumb-link" onClick={(e) => { e.preventDefault(); navigate('/cabinet'); }}>{fullName}</a>
            <span className="profile-page__breadcrumb-sep">/</span>
            <span className="profile-page__breadcrumb-current">Мой профиль</span>
          </nav>

          <h1 className="profile-page__heading">Мой профиль</h1>

          {/* Email banner */}
          {!p.email && (
            <div className="profile-page__banner">
              <span className="profile-page__banner-icon">⚠</span>
              Пожалуйста, укажите свой e-mail, чтобы получать информацию о статусе заказов.
              <a href="#" onClick={(e) => { e.preventDefault(); openContactEdit(); }}>Добавить e-mail</a>
            </div>
          )}

          {/* Two-column layout */}
          <div className="profile-page__layout">

            {/* ── Main column ── */}
            <div>
              {/* Контактные данные */}
              <Section title="Контактные данные">
                <Row label="Телефон" value={p.phone} onEdit={openContactEdit} onAdd={openContactEdit} />
                <Row label="E-mail" value={p.email} onAdd={openContactEdit} />
                <Row label="Адрес" value={p.address} onEdit={openContactEdit} onAdd={openContactEdit} />
              </Section>

              {/* Персональные данные */}
              <Section title="Персональные данные">
                <Row label="Имя" value={p.name} />
                <Row label="Фамилия" value={p.surname} />
                <Row label="Отчество" value={p.patronymic} />
                <Row label="Дата рождения" value={formatDate(p.birth_date)} />
                <Row label="Пол" value={genderMap[p.gender] || null} />
                <div className="profile-section__btn">
                  <button className="profile-btn" onClick={openPersonalEdit}>Редактировать</button>
                </div>
              </Section>

              {/* Безопасность */}
              <Section title="Безопасность">
                <Row label="Пароль" value="••••••••" onEdit={openPasswordEdit} />
              </Section>

              {/* Коммуникация */}
              <Section title="Коммуникация">
                <div className="profile-section__info">
                  <span className="profile-section__info-icon">i</span>
                  Добавьте удобные способы для коммуникации
                </div>
                <div className="profile-section__btn">
                  <button className="profile-btn">Добавить</button>
                </div>
              </Section>
            </div>

            {/* ── Sidebar ── */}
            <aside className="profile-sidebar">
              <div className="profile-sidebar__user">
                <span className="profile-sidebar__avatar">{(p.name?.[0] || 'U').toUpperCase()}{(p.surname?.[0] || '').toUpperCase()}</span>
                <span className="profile-sidebar__name">{fullName}</span>
              </div>

              <div className={`profile-sidebar__row ${!p.phone ? 'profile-sidebar__row--empty' : ''}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                </svg>
                {p.phone || 'Не указано'}
              </div>

              <div className={`profile-sidebar__row ${!p.email ? 'profile-sidebar__row--empty' : ''}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                {p.email || 'Не указано'}
              </div>

              <div className={`profile-sidebar__row ${!p.address ? 'profile-sidebar__row--empty' : ''}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                {p.address || 'Не указано'}
              </div>

              <div className="profile-sidebar__meta">
                <span>Создано:</span>
                <span className="profile-sidebar__meta-date">{formatDateTime(p.created_at)}</span>
              </div>

              <button className="profile-sidebar__logout" onClick={handleLogout}>
                Выйти
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </aside>
          </div>
        </div>
      </div>
      <Footer />

      {/* ═══ Edit Modals ═══ */}

      {/* Contact edit */}
      {editModal === 'contact' && (
        <div className="profile-edit-overlay" onClick={() => setEditModal(null)}>
          <div className="profile-edit-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Контактные данные</h3>
            {error && <div className="profile-edit-modal__error">{error}</div>}
            <label>Телефон</label>
            <input value={form.phone || ''} onChange={handlePhoneInput((v) => setForm({ ...form, phone: v }))} placeholder="+7 (___) ___-__-__" />
            <label>Адрес</label>
            <input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Город, улица, дом" />
            <div className="profile-edit-modal__actions">
              <button className="profile-edit-modal__cancel" onClick={() => setEditModal(null)}>Отменить</button>
              <button className="profile-edit-modal__save" disabled={saving} onClick={saveContact}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Personal edit */}
      {editModal === 'personal' && (
        <div className="profile-edit-overlay" onClick={() => setEditModal(null)}>
          <div className="profile-edit-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Персональные данные</h3>
            {error && <div className="profile-edit-modal__error">{error}</div>}
            <label>Имя</label>
            <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <label>Фамилия</label>
            <input value={form.surname || ''} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
            <label>Отчество</label>
            <input value={form.patronymic || ''} onChange={(e) => setForm({ ...form, patronymic: e.target.value })} />
            <label>Дата рождения</label>
            <input type="date" value={form.birth_date || ''} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
            <label>Пол</label>
            <select value={form.gender || ''} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Не указано</option>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </select>
            <div className="profile-edit-modal__actions">
              <button className="profile-edit-modal__cancel" onClick={() => setEditModal(null)}>Отменить</button>
              <button className="profile-edit-modal__save" disabled={saving} onClick={savePersonal}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Password edit */}
      {editModal === 'password' && (
        <div className="profile-edit-overlay" onClick={() => setEditModal(null)}>
          <div className="profile-edit-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Смена пароля</h3>
            {error && <div className="profile-edit-modal__error">{error}</div>}
            {success && <div className="profile-edit-modal__success">{success}</div>}
            <label>Текущий пароль</label>
            <input type="password" value={form.currentPassword || ''} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
            <label>Новый пароль</label>
            <input type="password" value={form.newPassword || ''} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} placeholder="Минимум 6 символов" />
            <label>Подтвердите новый пароль</label>
            <input type="password" value={form.confirmPassword || ''} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
            <div className="profile-edit-modal__actions">
              <button className="profile-edit-modal__cancel" onClick={() => setEditModal(null)}>Отменить</button>
              <button className="profile-edit-modal__save" disabled={saving} onClick={savePassword}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ProfilePage;
