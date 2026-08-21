import React, { useEffect, useState } from 'react';
import { API_BASE_URL, getHealth } from '../../lib/api';

type ConnectionState = 'checking' | 'connected' | 'error';

/**
 * Development indicator proving the React -> API client -> FastAPI -> React
 * round trip works. Not product UI; it renders nothing in production builds.
 */
export const BackendStatus: React.FC = () => {
  const [state, setState] = useState<ConnectionState>('checking');
  const [detail, setDetail] = useState<string>('');

  useEffect(() => {
    let active = true;
    getHealth()
      .then((health) => {
        if (!active) return;
        setState('connected');
        setDetail(health.status);
      })
      .catch((error: Error) => {
        if (!active) return;
        setState('error');
        setDetail(error.message);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!import.meta.env.DEV) return null;

  const label =
    state === 'connected'
      ? 'Backend connected'
      : state === 'checking'
        ? 'Checking backend…'
        : 'Backend unreachable';

  const tone =
    state === 'connected'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : state === 'checking'
        ? 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300'
        : 'border-red-500/30 bg-red-500/10 text-red-300';

  const dot =
    state === 'connected' ? 'bg-emerald-400' : state === 'checking' ? 'bg-zinc-400' : 'bg-red-400';

  return (
    <div
      data-testid="backend-status"
      data-state={state}
      title={`${API_BASE_URL}${detail ? ` — ${detail}` : ''}`}
      className={`fixed bottom-4 left-4 z-[200] flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-md ${tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${state === 'checking' ? 'animate-pulse' : ''}`} />
      {label}
    </div>
  );
};

export default BackendStatus;
