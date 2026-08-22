export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type Point = { lat: number; lng: number };

export type Place = Point & { label: string; context: string };

export type Factors = {
  light: number;
  isolation: number;
  crime: number;
  camera: number;
};

export type Segment = {
  name: string | null;
  kind: string | null;
  coords: [number, number][];
  length: number;
  score: number;
  factors: Factors;
};

export type Route = {
  id: 'fast' | 'balanced' | 'safest';
  label: string;
  distance: number;
  duration: number;
  safety: number;
  factors: Factors;
  weakest: { name: string; score: number; length: number }[];
  segments: Segment[];
  duplicateOf: string | null;
};

export type Zone = {
  lat: number;
  lng: number;
  radius: number;
  score: number;
  reason: 'darkness' | 'isolation' | 'crime';
  name: string | null;
};

export type Plan = {
  routes: Route[];
  zones: Zone[];
  snapped: { from: number; to: number };
};

export type Bbox = { south: number; west: number; north: number; east: number };

export type PlanRequest = {
  from: Point;
  to: Point;
  night: boolean;
  avoidUnlit: boolean;
  avoidIsolated: boolean;
};

export class ApiError extends Error {}

async function request<T>(path: string, init: RequestInit & { token?: string | null; timeoutMs?: number } = {}): Promise<T> {
  const { token, headers, timeoutMs = 90_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;

  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Server is waking up — Render free tier can take up to a minute. Try again.');
    }
    throw new ApiError('Cannot reach the routing service. Is the API running?');
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? 'Request failed');
  return data as T;
}

type Session = { token: string; user: { id: number; email: string; fullName?: string | null } };

export const api = {
  register: (email: string, password: string, fullName: string) =>
    request<Session>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, fullName }), timeoutMs: 120_000 }),

  login: (email: string, password: string) =>
    request<Session>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }), timeoutMs: 120_000 }),

  me: (token: string) => request<{ user: Session['user'] }>('/api/auth/me', { token }),

  area: () => request<{ bbox: Bbox; hotspots: number }>('/api/area'),

  search: (token: string, q: string) =>
    request<{ results: Place[] }>(`/api/geocode/search?q=${encodeURIComponent(q)}`, { token }),

  reverse: (token: string, lat: number, lng: number) =>
    request<{ result: Place }>(`/api/geocode/reverse?lat=${lat}&lng=${lng}`, { token }),

  plan: (token: string, body: PlanRequest) =>
    request<Plan>('/api/route', { method: 'POST', token, body: JSON.stringify(body) }),

  explain: (token: string, body: PlanRequest & { selected: string }) =>
    request<{ text: string; source: 'ai' | 'rules' }>('/api/explain', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),
};

export const scoreTone = (score: number) =>
  score >= 72 ? 'good' : score >= 55 ? 'fair' : ('poor' as const);

export const SCORE_COLORS: Record<string, string> = {
  good: '#10B981',
  fair: '#F59E0B',
  poor: '#EF4444',
};

export const formatDistance = (metres: number) =>
  metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`;
