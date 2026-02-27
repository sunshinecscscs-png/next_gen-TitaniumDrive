const API = '/api/cars';

function getToken() {
  return localStorage.getItem('autosite_token');
}

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

/* ── Public ── */

export async function fetchCars(params = {}) {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${API}?${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data; // { cars, total, page, pages }
}

export async function fetchCarById(id) {
  const res = await fetch(`${API}/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data; // { car }
}

/* ── Admin ── */

export async function fetchAdminCars({ page = 1, limit = 20, search = '' } = {}) {
  const qs = new URLSearchParams({ page, limit, search });
  const res = await fetch(`${API}/admin/list?${qs}`, { headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function fetchAdminCarById(id) {
  const res = await fetch(`${API}/admin/${id}`, { headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data; // { car }
}

export async function createCar(car) {
  const res = await fetch(`${API}/admin/create`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(car),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function updateCar(id, car) {
  const res = await fetch(`${API}/admin/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(car),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function deleteCar(id) {
  const res = await fetch(`${API}/admin/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function toggleCarPublish(id) {
  const res = await fetch(`${API}/admin/${id}/toggle`, {
    method: 'PATCH',
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function uploadCarImages(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('images', file);
  }
  const res = await fetch('/api/upload/cars', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
  return data; // { urls: string[] }
}

export async function deleteCarImage(filename) {
  const res = await fetch(`/api/upload/cars/${filename}`, {
    method: 'DELETE',
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка удаления');
  return data;
}
