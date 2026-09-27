import type { ScoreRequest, ScoreResponse, HealthResponse } from './types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'https://risk-weighted-review-router.onrender.com').replace(/\/$/, '');

export async function scorePR(req: ScoreRequest): Promise<ScoreResponse> {
  const res = await fetch(`${API_BASE}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Backend unreachable');
  return res.json();
}

