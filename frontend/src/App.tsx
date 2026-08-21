import React, { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
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
              <Landing />
            </PublicOnly>
          }
        />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <Register />
            </PublicOnly>
          }
        />
        <Route
          path="/dashboard/*"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;
