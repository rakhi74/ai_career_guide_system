const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export function getToken(){ return localStorage.getItem('acg_token'); }
export function setSession(token, user){ localStorage.setItem('acg_token', token); localStorage.setItem('acg_user', JSON.stringify(user)); }
export function clearSession(){ localStorage.removeItem('acg_token'); localStorage.removeItem('acg_user'); }
export function getUser(){ try { return JSON.parse(localStorage.getItem('acg_user') || 'null'); } catch { return null; } }
export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}
