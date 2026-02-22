/** Thin wrapper around fetch for talking to the NestJS backend. */

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...opts, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/* ── Auth ─────────────────────────────────────────────── */

export interface AuthResponse {
  access_token: string;
  user: { id: string; email: string; name: string; role: string };
}

export const api = {
  register: (body: { email: string; password: string; name: string }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  me: () => request<{ id: string; email: string; name: string; role: string }>('/auth/me'),

  /* ── Jobs ────────────────────────────────────────────── */

  getJobs: (params: Record<string, string | number>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== '' && v !== undefined) qs.set(k, String(v));
    }
    return request<{
      data: Job[];
      total: number;
      page: number;
      limit: number;
    }>(`/jobs?${qs.toString()}`);
  },

  getSources: () => request<string[]>('/jobs/sources'),
  getTopSkills: () => request<{ skill: string; count: number }[]>('/jobs/skills'),
};

/* ── Types ─────────────────────────────────────────────── */

export interface Job {
  id: string;
  source: string;
  title: string;
  company: string | null;
  location: string | null;
  tags: string[];
  cleaned_tags: string[];
  link: string;
  description: string | null;
  scraped_at: string;
}
