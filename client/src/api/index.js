const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const headers = (json = true) => {
  const h = {};
  if (json) h['Content-Type'] = 'application/json';
  const token = localStorage.getItem('token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

const handle = async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Ошибка сервера');
  return data;
};

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register = (username, email, password) =>
  fetch(`${BASE}/auth/register`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ username, email, password }),
  }).then(handle);

export const login = (email, password) =>
  fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ email, password }),
  }).then(handle);

export const getMe = () =>
  fetch(`${BASE}/auth/me`, { headers: headers() }).then(handle);

// ── Paintings ─────────────────────────────────────────────────────────────────
export const getFeed = (search = '', page = 1, limit = 20) =>
  fetch(`${BASE}/paintings?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`, {
    headers: headers(),
  }).then(handle);

export const getPainting = (id) =>
  fetch(`${BASE}/paintings/${id}`, { headers: headers() }).then(handle);

export const publishPainting = (data) =>
  fetch(`${BASE}/paintings`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify(data),
  }).then(handle);

export const deletePainting = (id) =>
  fetch(`${BASE}/paintings/${id}`, {
    method: 'DELETE', headers: headers(),
  }).then(handle);

export const toggleFavorite = (id) =>
  fetch(`${BASE}/paintings/${id}/favorite`, {
    method: 'POST', headers: headers(),
  }).then(handle);

// ── Users ─────────────────────────────────────────────────────────────────────
export const getUserProfile = (userId) =>
  fetch(`${BASE}/users/${userId}`, { headers: headers() }).then(handle);

export const getUserPaintings = (userId) =>
  fetch(`${BASE}/users/${userId}/paintings`, { headers: headers() }).then(handle);

export const getMyFavorites = () =>
  fetch(`${BASE}/users/me/favorites`, { headers: headers() }).then(handle);
