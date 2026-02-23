const API = '/api/notifications';
const TOKEN_KEY = 'autosite_token';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`,
  };
}

/**
 * Fetch user's notifications (newest first, max 50)
 */
export async function fetchNotifications() {
  const res = await fetch(API, { headers: authHeaders() });
  if (!res.ok) throw new Error('Ошибка загрузки уведомлений');
  return res.json();
}

/**
 * Get unread count for badge
 */
export async function fetchUnreadCount() {
  const res = await fetch(`${API}/unread-count`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Ошибка загрузки счётчика');
  return res.json();
}

/**
 * Mark all as read
 */
export async function markAllRead() {
  const res = await fetch(`${API}/read-all`, { method: 'PATCH', headers: authHeaders() });
  if (!res.ok) throw new Error('Ошибка');
  return res.json();
}

/**
 * Mark single notification as read
 */
export async function markRead(id) {
  const res = await fetch(`${API}/${id}/read`, { method: 'PATCH', headers: authHeaders() });
  if (!res.ok) throw new Error('Ошибка');
  return res.json();
}
