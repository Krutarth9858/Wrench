import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';

/**
 * Unknown paths used to `<Navigate to="/">`, which for a signed-in user bounced
 * straight to the dashboard — a typo looked like a working link. Authentication
 * redirects are untouched: protected routes still send signed-out users to /login.
 */
const NotFound: React.FC = () => {
  const { user } = useAuth();
  const target = user ? '/dashboard' : '/';

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-sans flex items-center justify-center px-6">
      <div className="pointer-events-none fixed inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-t from-[#18181B] via-transparent to-[#18181B]" />

      <div data-testid="not-found" className="relative glass-panel p-10 max-w-md w-full text-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-4 block">
          Error 404
        </span>
        <h1 className="text-3xl font-semibold tracking-tight mb-3">Page not found</h1>
        <p className="text-zinc-400 text-sm font-light mb-8">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to={target}
          className="inline-flex h-12 items-center rounded-2xl bg-emerald-500 px-7 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
        >
          {user ? 'Back to Dashboard' : 'Back to Home'}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
