/**
 * The two-experience switch.
 *
 * Wrench renders one of two purpose-built experiences, chosen by viewport:
 * the approved desktop UI at >= 768px, the mobile UI below it. These wrappers
 * are the only place that choice is made, so no page has to know about the
 * other experience and the desktop components are never modified to
 * accommodate mobile.
 *
 * Only presentation branches here. Hooks, API clients, auth, booking, payment
 * and realtime logic are shared by both sides.
 */
import { useIsMobile } from '../hooks/useIsMobile';

import Landing from './Landing';
import Dashboard from './Dashboard';
import Login from './Login';
import Register from './Register';

import MobileDashboard from './MobileDashboard';
import MobileLanding from './mobile/MobileLanding';
import MobileLogin from './mobile/MobileLogin';
import MobileRegister from './mobile/MobileRegister';

export function ResponsiveLanding() {
  return useIsMobile() ? <MobileLanding /> : <Landing />;
}

export function ResponsiveLogin() {
  return useIsMobile() ? <MobileLogin /> : <Login />;
}

export function ResponsiveRegister() {
  return useIsMobile() ? <MobileRegister /> : <Register />;
}

export function ResponsiveDashboard() {
  return useIsMobile() ? <MobileDashboard /> : <Dashboard />;
}
