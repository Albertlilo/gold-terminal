import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
export const API = import.meta.env.VITE_API_BASE_URL || 'https://gold-terminal-ufv4.onrender.com';
let pending;
export function accountClient() {
  if (!pending) pending = (async () => {
    const response = await fetch(`${API}/api/account/config`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Account settings are unavailable.');
    const data = await response.json();
    if (!data.firebase) throw new Error('Account sign-in is being configured. The free preview remains available.');
    return getAuth(initializeApp(data.firebase));
  })().catch(error => { pending = null; throw error; });
  return pending;
}
export async function accountFetch(url, options = {}) {
  const auth = await accountClient();
  const headers = new Headers(options.headers);
  const token = await auth.currentUser?.getIdToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}
export async function readAccount() {
  const response = await accountFetch(`${API}/api/account/me`, { signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Account access could not be verified.');
  return data;
}
