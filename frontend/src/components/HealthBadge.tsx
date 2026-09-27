import { useEffect, useState } from 'react';
import { fetchHealth } from '../api';
import type { HealthResponse } from '../types';

export function HealthBadge() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      try {
        const h = await fetchHealth();
        if (active) {
          setHealth(h);
          setError(false);
          setIsRetrying(false);
          timer = setTimeout(check, 15_000);
        }
      } catch {
        if (active) {
          setError(true);
          setIsRetrying(true);
          timer = setTimeout(check, 3_000);
        }
      }
    };

    check();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  if (error) {
    return (
      <span className="badge badge-error">
        <span className="dot" /> {isRetrying ? 'Connecting (Backend waking up…)' : 'Backend offline'}
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

