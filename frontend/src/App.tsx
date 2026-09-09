import React, { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { ResponsiveLanding, ResponsiveLogin, ResponsiveRegister, ResponsiveDashboard } from './pages/ResponsivePages';
import GoogleCallback from './pages/GoogleCallback';
import VerifyEmail from './pages/VerifyEmail';
import NotFound from './pages/NotFound';
import BookingPage from './components/dashboard/BookingPage';
import BackendStatus from './components/dev/BackendStatus';
import { Toaster } from 'sonner';

const SessionPending: React.FC = () => (
  <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center text-zinc-500 text-sm">
    Loading…
  </div>
);

/** Marketing pages (the scroll-scrubbed hero) are for signed-out visitors only. */
const PublicOnly: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, status } = useAuth();
  if (status !== 'ready') return <SessionPending />;
  return user ? <Navigate to="/dashboard" replace /> : children;
};

/** Everything behind the account lives here. */
const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, status } = useAuth();
  if (status !== 'ready') return <SessionPending />;
  return user ? children : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  const loadSession = useAuth((state) => state.loadSession);

  // Exchange the persisted refresh token for an access token exactly once on boot.
  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  return (
    <>
      <BackendStatus />
      <Toaster theme="dark" position="top-right" richColors />
      <Routes>
        <Route
          path="/"
          element={
            <PublicOnly>
              <ResponsiveLanding />
            </PublicOnly>
          }
        />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <ResponsiveLogin />
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <ResponsiveRegister />
            </PublicOnly>
          }
        />
        {/* Full-page booking screen: deliberately outside the dashboard shell so
            no sidebar or map is rendered beside it. */}
        <Route
          path="/booking/:mechanicId"
          element={
            <RequireAuth>
              <BookingPage />
            </RequireAuth>
          }
        />
        {/* Where Google returns the browser. Public: the code is useless
            without the server's client secret and signed state. */}
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        {/* Not PublicOnly: registration already signed this account in, and the
            guard would bounce straight past the code entry. */}
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route
          path="/dashboard/*"
          element={
            <RequireAuth>
              <ResponsiveDashboard />
            </RequireAuth>
          }
        />
        {/* Unknown paths get a real 404 rather than a silent bounce to "/". */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default App;
