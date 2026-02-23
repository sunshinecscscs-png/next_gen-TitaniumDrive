const API = '/api/favorites';

function getToken() {
  return localStorage.getItem('autosite_token');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

/** Toggle favorite on/off. Returns { favorited: boolean } */
export async function toggleFavorite(carId) {
  const res = await fetch(`${API}/${carId}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Ошибка');
  const data = await res.json();
  /* notify Header badge */
  window.dispatchEvent(new CustomEvent('favorites-changed'));
  return data;
}

/** Get array of car IDs the user has liked */
export async function fetchFavoriteIds() {
  const res = await fetch(`${API}/ids`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Ошибка');
  const data = await res.json();
  return data.ids;           // number[]
}

/** Get full favorite car objects */
export async function fetchFavorites() {
  const res = await fetch(API, { headers: authHeaders() });
  if (!res.ok) throw new Error('Ошибка');
  const data = await res.json();
  return data.cars;
}
