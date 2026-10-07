const TOKEN_KEY = 'shareon.token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
  }

  /** Field errors keyed by path (e.g. "email"). */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details ?? []) if (!out[d.path]) out[d.path] = d.message;
    return out;
  }
}

const BASE = import.meta.env.VITE_API_URL ?? '';

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers, body });
  } catch {
    throw new ApiError(0, 'Nepodarilo sa spojiť so serverom. Skontroluj pripojenie.');
  }
  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  const data = res.status === 204 ? null : isJson ? await res.json().catch(() => null) : null;
  if (res.ok && res.status !== 204 && data === null) {
    // e.g. an HTML page returned for an /api route (misconfigured proxy/hosting)
    throw new ApiError(res.status, 'Server vrátil neočakávanú odpoveď. Skús to znova neskôr.');
  }
  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.set(null);
      window.dispatchEvent(new Event('shareon:logout'));
    }
    throw new ApiError(res.status, data?.error?.message ?? 'Nastala chyba.', data?.error?.details);
  }
  return data as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, json?: unknown) => api<T>(path, { method: 'POST', json: json ?? {} });
export const patch = <T>(path: string, json?: unknown) => api<T>(path, { method: 'PATCH', json: json ?? {} });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

export const uploadImage = async (file: File): Promise<string> => {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api<{ url: string }>('/api/uploads', { method: 'POST', body: fd });
  return res.url;
};
