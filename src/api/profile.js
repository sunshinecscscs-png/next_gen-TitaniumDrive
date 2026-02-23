const API = '/api/profile';

function getToken() {
  return localStorage.getItem('autosite_token');
}

export async function fetchProfile() {
  const res = await fetch(API, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка загрузки профиля');
  return data; // { user }
}

export async function updateProfile(fields) {
  const res = await fetch(API, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка обновления профиля');
  return data; // { user }
}

export async function updatePassword({ currentPassword, newPassword }) {
  const res = await fetch(`${API}/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка смены пароля');
  return data;
}
