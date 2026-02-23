const API = '/api/chat';
const TOKEN_KEY = 'autosite_token';
const GUEST_ID_KEY = 'autosite_guest_id';

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}` };
}

function guestHeaders() {
  return { 'Content-Type': 'application/json', 'x-guest-id': getOrCreateGuestId() };
}

/** Get or create a persistent guest ID */
export function getOrCreateGuestId() {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = 'guest_' + crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

/** User: get own room + messages */
export async function fetchMyChat() {
  const res = await fetch(`${API}/my`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка');
  return res.json();
}

/** Guest: get own room + messages */
export async function fetchGuestChat() {
  const res = await fetch(`${API}/guest`, { headers: guestHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка');
  return res.json();
}

/** User: send message in own room */
export async function sendMyMessage(text) {
  const res = await fetch(`${API}/my/send`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка');
  return res.json();
}

/** User: mark messages as read */
export async function markMyMessagesRead() {
  const res = await fetch(`${API}/my/read`, { method: 'PATCH', headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка');
  return res.json();
}

/** Guest: mark messages as read */
export async function markGuestMessagesRead() {
  const res = await fetch(`${API}/guest/read`, { method: 'PATCH', headers: guestHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка');
  return res.json();
}

/* ═══════════ ADMIN ═══════════ */

/** Admin: list all rooms */
export async function fetchChatRooms() {
  const res = await fetch(`${API}/rooms`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка');
  return res.json();
}

/** Admin: messages for room */
export async function fetchRoomMessages(roomId) {
  const res = await fetch(`${API}/rooms/${roomId}/messages`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка');
  return res.json();
}

/** Admin: send message in room */
export async function sendRoomMessage(roomId, text) {
  const res = await fetch(`${API}/rooms/${roomId}/send`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка');
  return res.json();
}

/** Admin: mark user msgs as read */
export async function markRoomRead(roomId) {
  const res = await fetch(`${API}/rooms/${roomId}/read`, { method: 'PATCH', headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка');
  return res.json();
}

/** Admin: total unread */
export async function fetchChatUnreadTotal() {
  const res = await fetch(`${API}/unread-total`, { headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка');
  return res.json();
}

/** Admin: claim a chat room */
export async function claimChatRoom(roomId) {
  const res = await fetch(`${API}/rooms/${roomId}/claim`, { method: 'PATCH', headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Ошибка');
  return res.json();
}
