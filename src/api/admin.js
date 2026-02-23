const API = '/api/admin';

function getToken() {
  return localStorage.getItem('autosite_token');
}

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

export async function checkHasAdmin() {
  const res = await fetch(`${API}/has-admin`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data; // { hasAdmin: boolean }
}

export async function setupFirstAdmin({ name, email, password, nickname }) {
  const res = await fetch(`${API}/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, nickname }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data; // { user, token }
}

export async function registerAdmin({ name, email, password, nickname }) {
  const res = await fetch(`${API}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, nickname }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data; // { user, token }
}

export async function createAdmin({ name, email, password, nickname }) {
  const res = await fetch(`${API}/create-admin`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ name, email, password, nickname }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function fetchAdminsList() {
  const res = await fetch(`${API}/admins-list`, { headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data; // { admins: [{ id, nickname, name, email }] }
}

export async function fetchAdminStats() {
  const res = await fetch(`${API}/stats`, { headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function fetchAdminUsers({ page = 1, limit = 20, search = '' } = {}) {
  const params = new URLSearchParams({ page, limit, search });
  const res = await fetch(`${API}/users?${params}`, { headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function fetchUserDetail(userId) {
  const res = await fetch(`${API}/users/${userId}`, { headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data; // { user }
}

export async function changeUserRole(userId, role) {
  const res = await fetch(`${API}/users/${userId}/role`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function deleteUser(userId) {
  const res = await fetch(`${API}/users/${userId}`, {
    method: 'DELETE',
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}
