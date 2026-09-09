import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import MobileShell from '../components/mobile/MobileShell';
import MobileCustomerHome from './mobile/MobileCustomerHome';
import MobileMechanicHome from './mobile/MobileMechanicHome';
import MobileFindMechanic from './mobile/MobileFindMechanic';
import MobileBookings from './mobile/MobileBookings';
import MobileAppointments from './mobile/MobileAppointments';
import MobileProfile from './mobile/MobileProfile';

// Screens whose desktop implementation is already a single stacked column and
// works well inside the mobile shell. Wrapped rather than rebuilt, so there is
// no second copy of their logic to keep in step.
import Troubleshoot from '../components/dashboard/Troubleshoot';
import ScheduleService from '../components/dashboard/ScheduleService';
import MechanicBookings from '../components/dashboard/MechanicBookings';
import MechanicProfilePanel from '../components/dashboard/MechanicProfilePanel';
import MechanicAppointments from '../components/dashboard/MechanicAppointments';
import MechanicEarnings from '../components/dashboard/MechanicEarnings';
import NotFoundPanel from '../components/dashboard/NotFoundPanel';

/**
 * The mobile dashboard.
 *
 * A parallel router to the desktop `Dashboard`, not a variant of it — the
 * desktop file is untouched. Every screen renders inside `MobileShell` (compact
 * header, tab bar, safe areas) except discovery, which is full-bleed because
 * the map is the screen.
 */
export default function MobileDashboard() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const isMechanic = user?.role === 'MECHANIC';

  /** Nested screens get a back affordance instead of the logo. */
  const back = () => navigate('/dashboard');
  const shell = (node: React.ReactNode, title?: string, opts: {
    nested?: boolean; bleed?: boolean; hideNav?: boolean;
  } = {}) => (
    <MobileShell
      title={title}
      isMechanic={isMechanic}
      bleed={opts.bleed}
      hideNav={opts.hideNav}
      onBack={opts.nested ? back : undefined}
    >
      {node}
    </MobileShell>
  );

  if (isMechanic) {
    return (
      <Routes>
        <Route path="/" element={shell(<MobileMechanicHome />)} />
        <Route path="/requests" element={shell(<MechanicBookings view="requests" />, 'Requests', { nested: true })} />
        <Route path="/active" element={shell(<MechanicBookings view="active" />, 'Active', { nested: true })} />
        <Route path="/history" element={shell(<MechanicBookings view="history" />, 'History', { nested: true })} />
        <Route path="/bookings" element={shell(<MechanicBookings />, 'Bookings', { nested: true })} />
        <Route path="/appointments" element={shell(<MechanicAppointments />, 'Appointments', { nested: true })} />
        <Route path="/earnings" element={shell(<MechanicEarnings />, 'Earnings', { nested: true })} />
        <Route path="/schedule" element={shell(<MechanicProfilePanel />, 'Schedule', { nested: true })} />
        <Route path="/availability" element={shell(<MobileProfile />, 'Status', { nested: true })} />
        <Route path="/profile" element={shell(<MechanicProfilePanel />, 'Profile', { nested: true })} />
        <Route path="*" element={shell(<NotFoundPanel />, 'Not found', { nested: true })} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={shell(<MobileCustomerHome />)} />
      {/* No shell: the map IS the screen. It carries its own floating back
          control, search, filters and tab bar. */}
      <Route path="/find" element={<MobileFindMechanic />} />
      <Route path="/bookings" element={shell(<MobileBookings />, 'Assistance', { nested: true })} />
      <Route path="/appointments" element={shell(<MobileAppointments />, 'Service', { nested: true })} />
      <Route path="/schedule-service" element={shell(<ScheduleService />, 'Schedule Service', { nested: true })} />
      <Route path="/troubleshoot" element={shell(<Troubleshoot />, 'Wrench AI', { nested: true })} />
      <Route path="/profile-m" element={shell(<MobileProfile />, 'Profile', { nested: true })} />
      {/* The desktop profile route is the account screen; mobile keeps its own. */}
      <Route path="/profile" element={<Navigate to="/dashboard/profile-m" replace state={{ from: location.pathname }} />} />
      <Route path="*" element={shell(<NotFoundPanel />, 'Not found', { nested: true })} />
    </Routes>
  );
}
