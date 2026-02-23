const API = '/api/orders';
const TOKEN_KEY = 'autosite_token';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`,
  };
}

/**
 * Place an order for a car
 * @param {{ car_id: number, phone?: string, name?: string }} data
 */
export async function placeOrder(data) {
  const res = await fetch(API, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка оформления заказа');
  }
  return res.json();
}
