const API = '/api/reviews';

function getToken() {
  return localStorage.getItem('autosite_token');
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
  };
}

/* ── Public ── */
export async function fetchPublicReviews() {
  const res = await fetch(API);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data; // { reviews }
}

/* ── Admin ── */
export async function fetchAdminReviews(page = 1) {
  const res = await fetch(`${API}/admin?page=${page}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data; // { reviews, total, page, pages }
}

export async function createReview(formData) {
  const res = await fetch(API, {
    method: 'POST',
    headers: authHeaders(),
    body: formData, // FormData — не ставим Content-Type
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data; // { review }
}

export async function updateReview(id, formData) {
  const res = await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data; // { review }
}

export async function deleteReview(id) {
  const res = await fetch(`${API}/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function toggleReviewPublish(id) {
  const res = await fetch(`${API}/${id}/publish`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data; // { review }
}
