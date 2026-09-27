import { useEffect, useState } from 'react';
import { fetchHealth } from '../api';
import type { HealthResponse } from '../types';

export function HealthBadge() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const h = await fetchHealth();
        if (active) { setHealth(h); setError(false); }
      } catch {
        if (active) setError(true);
      }
    };
    check();
    const id = setInterval(check, 15_000);
    return () => { active = false; clearInterval(id); };
  }, []);

  if (error) {
    return (
      <span className="badge badge-error">
        <span className="dot" /> Backend offline
      </span>
    );
  }
  if (!health) {
    return <span className="badge badge-neutral">Connecting…</span>;
  }
  return (
    <span className="badge badge-ok">
      <span className="dot" /> Backend online
    </span>
  );
}
