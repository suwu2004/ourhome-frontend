export const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://ourhome-backend.onrender.com';
export const TOKEN_KEY = 'ourhome_token';

export function apiFetch(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}
