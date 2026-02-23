const API = '/api/callback-requests';
const TOKEN_KEY = 'autosite_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

/**
 * Submit a new callback request (public — no auth needed)
 * @param {{ type, name, phone, email?, car_id?, car_name?, topic?, order_number?, message? }} data
 */
export async function submitCallbackRequest(data) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка при отправке заявки');
  }
  return res.json();
}

/**
 * Fetch the current user's own requests
 * @param {{ type?: string }} params
 */
export async function fetchMyRequests(params = {}) {
  const qs = new URLSearchParams();
  if (params.type) qs.set('type', params.type);
  const url = qs.toString() ? `${API}/my?${qs}` : `${API}/my`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка загрузки заявок');
  }
  return res.json();
}

/**
 * Fetch only the current user's orders
 */
export async function fetchMyOrders() {
  return fetchMyRequests({ type: 'order' });
}

/**
 * Fetch all callback requests (admin only)
 * @param {{ page?, limit?, type?, status?, search? }} params
 */
export async function fetchCallbackRequests(params = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', params.page);
  if (params.limit) qs.set('limit', params.limit);
  if (params.type) qs.set('type', params.type);
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.claimed_by) qs.set('claimed_by', params.claimed_by);

  const res = await fetch(`${API}?${qs}`, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка загрузки заявок');
  }
  return res.json();
}

/**
 * Fetch quick stats for dashboard
 */
export async function fetchCallbackStats() {
  const res = await fetch(`${API}/stats`, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка загрузки статистики');
  }
  return res.json();
}

/**
 * Update request status (admin only)
 * @param {number} id
 * @param {string} status  'new' | 'processed' | 'closed'
 */
export async function updateCallbackStatus(id, status) {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка обновления статуса');
  }
  return res.json();
}

/**
 * Delete a callback request (admin only)
 * @param {number} id
 */
export async function deleteCallbackRequest(id) {
  const res = await fetch(`${API}/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка удаления заявки');
  }
  return res.json();
}

/**
 * Claim (take responsibility for) a callback request (admin only)
 * @param {number} id
 */
export async function claimCallbackRequest(id) {
  const res = await fetch(`${API}/${id}/claim`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка взятия заявки');
  }
  return res.json();
}
