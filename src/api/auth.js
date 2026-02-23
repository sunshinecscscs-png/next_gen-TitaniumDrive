const API = '/api/auth';

export async function sendVerificationCode({ name, email, password, phone }) {
  const res = await fetch(`${API}/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, phone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка отправки кода');
  return data;
}

export async function verifyCodeAndRegister({ email, code }) {
  const res = await fetch(`${API}/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка верификации');
  return data; // { user, token }
}

export async function registerUser({ name, email, password, phone }) {
  const res = await fetch(`${API}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, phone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка регистрации');
  return data; // { user, token }
}

export async function loginUser({ email, password }) {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка входа');
  return data; // { user, token }
}

export async function fetchMe(token) {
  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Не авторизован');
  return data; // { user }
}
