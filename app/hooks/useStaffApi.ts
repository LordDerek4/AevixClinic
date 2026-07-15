'use client';

import { useAuth } from '../context/AuthContext';

export function useStaffApi() {
  const { getIdToken } = useAuth();

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getIdToken();
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(path, { ...init, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  return { request };
}
