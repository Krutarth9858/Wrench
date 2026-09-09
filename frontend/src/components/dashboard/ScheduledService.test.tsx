import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ServiceCard from './ServiceCard';
import ScheduleService from './ScheduleService';
import MyAppointments from './MyAppointments';
import MechanicAppointments from './MechanicAppointments';
import { ApiError } from '../../lib/api';
import * as api from '../../lib/appointments';
import * as discovery from '../../lib/discovery';

vi.mock('../../lib/appointments', async () => {
  const actual = await vi.importActual<typeof import('../../lib/appointments')>(
    '../../lib/appointments');
  return {
    ...actual,
    listServicePackages: vi.fn(), listSlots: vi.fn(), createAppointment: vi.fn(),
    listAppointments: vi.fn(), actOnAppointment: vi.fn(), quoteAppointment: vi.fn(),
    createPaymentOrder: vi.fn(), confirmPayment: vi.fn(), markPaymentFailed: vi.fn(),
    refundAppointment: vi.fn(),
  };
});
vi.mock('../../lib/discovery', async () => {
  const actual = await vi.importActual<typeof import('../../lib/discovery')>('../../lib/discovery');
  return { ...actual, findNearbyMechanics: vi.fn(), getCurrentPosition: vi.fn() };
});
vi.mock('../../lib/checkout', () => ({
  openCheckout: vi.fn(async () => ({
    order_id: 'order_1', payment_id: 'pay_1', signature: 'sig',
  })),
}));
// Scheduled Service shares the existing socket; these tests only need to mount.
vi.mock('../../hooks/useAppointmentRealtime', () => ({ useAppointmentRealtime: () => {} }));

const { openCheckout } = await import('../../lib/checkout');

const pkg = (over: Partial<api.ServicePackage> = {}): api.ServicePackage => ({
  id: 'p-basic', service_type: 'BASIC', vehicle_type: 'CAR', name: 'Basic Service',
  description: 'Routine maintenance to keep your vehicle in good condition.',
  included_items: ['Engine oil check/replacement', 'Brake inspection'],
  best_for: 'Regular preventive maintenance.', price_minor: 149900,
  duration_minutes: 90, ...over,
});

const CUSTOM = pkg({
  id: 'p-custom', service_type: 'CUSTOM', name: 'Custom Service', price_minor: null,
});

const MECHANIC: discovery.NearbyMechanic = {
  id: 'm-1', garage_name: 'Speedy Auto', specialization: 'Engine', city: 'Ahmedabad',
  latitude: 23.07, longitude: 72.57, supported_vehicle_types: ['BIKE', 'CAR'],
  is_available: true, service_radius_km: 25, experience_years: 10,
  average_rating: 0, total_reviews: 0, distance_km: 3.2,
};

const appointment = (over: Partial<api.Appointment> = {}): api.Appointment => ({
  id: 'a-1', service_type: 'BASIC', service_name: 'Basic Service', vehicle_type: 'CAR',
  appointment_date: '2026-09-19', start_time: '10:00:00', end_time: '11:30:00',
  duration_minutes: 90, description: null, service_address: null,
  status: 'CONFIRMED', payment_status: 'PAID', price_minor: 149900,
  customer: { name: 'c@example.com', phone_number: null },
  mechanic: { name: 'Speedy Auto', phone_number: null }, ...over,
});

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('service cards', () => {
  it('shows the price the server gave for that vehicle type', () => {
    wrap(<ServiceCard pkg={pkg()} selected={false} onSelect={() => {}} />);
    expect(screen.getByTestId('price-BASIC')).toHaveTextContent('₹1,499');
  });

  it('prices the same service differently per vehicle type', () => {
    const { unmount } = wrap(
      <ServiceCard pkg={pkg({ vehicle_type: 'BIKE', price_minor: 49900 })}
        selected={false} onSelect={() => {}} />);
    expect(screen.getByTestId('price-BASIC')).toHaveTextContent('₹499');
    unmount();
    wrap(<ServiceCard pkg={pkg()} selected={false} onSelect={() => {}} />);
    expect(screen.getByTestId('price-BASIC')).toHaveTextContent('₹1,499');
  });

  it('never invents a price for Custom Service', () => {
    wrap(<ServiceCard pkg={CUSTOM} selected={false} onSelect={() => {}} />);
    expect(screen.getByTestId('price-CUSTOM')).toHaveTextContent('Quotation');
    expect(screen.getByTestId('price-CUSTOM').textContent).not.toMatch(/₹\s?\d/);
  });

  it('keeps the included list collapsed until asked', async () => {
    wrap(<ServiceCard pkg={pkg()} selected={false} onSelect={() => {}} />);
    expect(screen.queryByTestId('includes-BASIC')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('includes-toggle-BASIC'));
    expect(screen.getByTestId('includes-BASIC')).toHaveTextContent('Brake inspection');
  });
});

describe('scheduling a service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listServicePackages).mockResolvedValue([pkg(), CUSTOM]);
    vi.mocked(discovery.getCurrentPosition).mockResolvedValue({
      latitude: 23.02, longitude: 72.57 });
    vi.mocked(discovery.findNearbyMechanics).mockResolvedValue([MECHANIC]);
    vi.mocked(api.listSlots).mockResolvedValue({
      slots: ['10:00:00', '11:00:00'], duration_minutes: 90 });
    vi.mocked(api.createAppointment).mockResolvedValue(
      appointment({ status: 'PAYMENT_PENDING', payment_status: 'PENDING' }));
    vi.mocked(api.createPaymentOrder).mockResolvedValue({
      order_id: 'order_1', amount_minor: 149900, currency: 'INR',
      provider: 'stub', public_key: 'stub_key' });
    vi.mocked(api.confirmPayment).mockResolvedValue(
      appointment({ status: 'PAYMENT_CONFIRMED' }));
  });

  const reachServices = async () => {
    const user = userEvent.setup();
    wrap(<ScheduleService />);
    await user.click(screen.getByTestId('vehicle-CAR'));
    await screen.findByTestId('service-card-BASIC');
    return user;
  };

  it('fetches the catalogue for the chosen vehicle type', async () => {
    await reachServices();
    expect(api.listServicePackages).toHaveBeenCalledWith('CAR');
  });

  it('walks vehicle → service → garage → slot → review', async () => {
    const user = await reachServices();
    await user.click(screen.getByTestId('select-BASIC'));
    await user.click(screen.getByTestId('service-continue'));

    await screen.findByTestId('mechanic-list');
    await user.click(screen.getByTestId('mechanic-m-1'));

    await screen.findByTestId('slot-grid');
    await user.click(screen.getByTestId('slot-10:00:00'));
    await user.click(screen.getByTestId('slot-continue'));

    expect(await screen.findByTestId('review-panel')).toHaveTextContent('Speedy Auto');
    expect(screen.getByTestId('review-price')).toHaveTextContent('₹1,499');
  });

  it('only offers slots the server said were free', async () => {
    const user = await reachServices();
    await user.click(screen.getByTestId('select-BASIC'));
    await user.click(screen.getByTestId('service-continue'));
    await screen.findByTestId('mechanic-list');
    await user.click(screen.getByTestId('mechanic-m-1'));

    await screen.findByTestId('slot-grid');
    expect(screen.getByTestId('slot-10:00:00')).toBeInTheDocument();
    expect(screen.queryByTestId('slot-09:00:00')).not.toBeInTheDocument();
  });

  it('says so when a day has nothing free', async () => {
    vi.mocked(api.listSlots).mockResolvedValue({ slots: [], duration_minutes: 90 });
    const user = await reachServices();
    await user.click(screen.getByTestId('select-BASIC'));
    await user.click(screen.getByTestId('service-continue'));
    await screen.findByTestId('mechanic-list');
    await user.click(screen.getByTestId('mechanic-m-1'));

    expect(await screen.findByTestId('slots-empty')).toHaveTextContent('No times available');
  });

  it('pays through the gateway and never sends a price', async () => {
    const user = await reachServices();
    await user.click(screen.getByTestId('select-BASIC'));
    await user.click(screen.getByTestId('service-continue'));
    await screen.findByTestId('mechanic-list');
    await user.click(screen.getByTestId('mechanic-m-1'));
    await screen.findByTestId('slot-grid');
    await user.click(screen.getByTestId('slot-10:00:00'));
    await user.click(screen.getByTestId('slot-continue'));
    await user.click(await screen.findByTestId('confirm-appointment'));

    await waitFor(() => expect(api.confirmPayment).toHaveBeenCalled());
    expect(openCheckout).toHaveBeenCalled();
    // The creation payload carries no amount at all.
    expect(vi.mocked(api.createAppointment).mock.calls[0][0]).not.toHaveProperty('price_minor');
  });

  it('requires a description for Custom Service and does not charge for it', async () => {
    const user = await reachServices();
    await user.click(screen.getByTestId('select-CUSTOM'));
    expect(screen.getByTestId('service-continue')).toBeDisabled();

    await user.type(screen.getByTestId('custom-description'), 'Clutch is slipping badly');
    expect(screen.getByTestId('service-continue')).toBeEnabled();

    await user.click(screen.getByTestId('service-continue'));
    await screen.findByTestId('mechanic-list');
    await user.click(screen.getByTestId('mechanic-m-1'));
    await screen.findByTestId('slot-grid');
    await user.click(screen.getByTestId('slot-10:00:00'));
    await user.click(screen.getByTestId('slot-continue'));

    expect(await screen.findByTestId('custom-notice')).toHaveTextContent('no fixed price');
    expect(screen.getByTestId('review-price')).toHaveTextContent('Quotation');

    await user.click(screen.getByTestId('confirm-appointment'));
    await waitFor(() => expect(api.createAppointment).toHaveBeenCalled());
    // A custom request is never pushed into the fixed-price payment flow.
    expect(api.createPaymentOrder).not.toHaveBeenCalled();
  });

  it('surfaces a slot taken between loading and confirming', async () => {
    vi.mocked(api.createAppointment).mockRejectedValue(
      new ApiError(409, null, 'That slot has just been taken. Please choose another time.'));
    const user = await reachServices();
    await user.click(screen.getByTestId('select-BASIC'));
    await user.click(screen.getByTestId('service-continue'));
    await screen.findByTestId('mechanic-list');
    await user.click(screen.getByTestId('mechanic-m-1'));
    await screen.findByTestId('slot-grid');
    await user.click(screen.getByTestId('slot-10:00:00'));
    await user.click(screen.getByTestId('slot-continue'));
    await user.click(await screen.findByTestId('confirm-appointment'));

    expect(await screen.findByTestId('schedule-error')).toHaveTextContent('just been taken');
  });
});

describe('my service appointments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listAppointments).mockResolvedValue([]);
  });

  it('shows an empty state before anything is booked', async () => {
    wrap(<MyAppointments />);
    expect(await screen.findByTestId('upcoming-empty')).toHaveTextContent('No upcoming appointments');
  });

  it('splits upcoming work from service history', async () => {
    vi.mocked(api.listAppointments).mockResolvedValue([
      appointment({ id: 'a-up', status: 'CONFIRMED' }),
      appointment({ id: 'a-done', status: 'COMPLETED' }),
      appointment({ id: 'a-gone', status: 'CANCELLED' }),
    ]);
    wrap(<MyAppointments />);
    const upcoming = await screen.findByTestId('upcoming-list');
    expect(upcoming).toHaveTextContent('Basic Service');
    expect(screen.getByTestId('appointment-a-done')).toBeInTheDocument();
    expect(screen.getByTestId('history-list')).toContainElement(
      screen.getByTestId('appointment-a-gone'));
  });

  it('shows the amount paid and payment state', async () => {
    vi.mocked(api.listAppointments).mockResolvedValue([appointment()]);
    wrap(<MyAppointments />);
    expect(await screen.findByTestId('price-a-1')).toHaveTextContent('₹1,499');
    expect(screen.getByTestId('appointment-a-1')).toHaveTextContent('Paid');
  });

  it('offers a quotation for approval and pays only once approved', async () => {
    vi.mocked(api.listAppointments).mockResolvedValue([
      appointment({ service_type: 'CUSTOM', service_name: 'Custom Service',
        status: 'QUOTED', payment_status: 'NOT_REQUIRED', price_minor: 250000 }),
    ]);
    vi.mocked(api.actOnAppointment).mockResolvedValue(
      appointment({ status: 'PAYMENT_PENDING', payment_status: 'PENDING',
        price_minor: 250000 }));
    vi.mocked(api.createPaymentOrder).mockResolvedValue({
      order_id: 'order_2', amount_minor: 250000, currency: 'INR',
      provider: 'stub', public_key: 'stub_key' });
    vi.mocked(api.confirmPayment).mockResolvedValue(appointment({ status: 'PAYMENT_CONFIRMED' }));

    wrap(<MyAppointments />);
    const approve = await screen.findByTestId('approve-a-1');
    expect(approve).toHaveTextContent('₹2,500');

    await userEvent.click(approve);
    await waitFor(() => expect(api.actOnAppointment).toHaveBeenCalledWith('a-1', 'accept-quotation'));
    await waitFor(() => expect(api.confirmPayment).toHaveBeenCalled());
  });

  it('records a dismissed checkout instead of claiming success', async () => {
    vi.mocked(openCheckout).mockResolvedValueOnce(null);
    vi.mocked(api.listAppointments).mockResolvedValue([
      appointment({ status: 'PAYMENT_PENDING', payment_status: 'PENDING' })]);
    vi.mocked(api.createPaymentOrder).mockResolvedValue({
      order_id: 'order_1', amount_minor: 149900, currency: 'INR',
      provider: 'stub', public_key: 'stub_key' });

    wrap(<MyAppointments />);
    await userEvent.click(await screen.findByTestId('pay-a-1'));

    await waitFor(() => expect(api.markPaymentFailed).toHaveBeenCalledWith('a-1'));
    expect(api.confirmPayment).not.toHaveBeenCalled();
  });

  it('surfaces a failed load rather than showing an empty history', async () => {
    vi.mocked(api.listAppointments).mockRejectedValue(
      new ApiError(500, null, 'Server unavailable'));
    wrap(<MyAppointments />);
    expect(await screen.findByTestId('appointments-error')).toHaveTextContent('Server unavailable');
  });
});

describe('mechanic appointments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listAppointments).mockResolvedValue([]);
  });

  it('offers accept and decline only once the work is paid for', async () => {
    vi.mocked(api.listAppointments).mockResolvedValue([
      appointment({ status: 'PAYMENT_CONFIRMED' })]);
    wrap(<MechanicAppointments />);
    expect(await screen.findByTestId('accept-a-1')).toBeInTheDocument();
    expect(screen.getByTestId('decline-a-1')).toBeInTheDocument();
    expect(screen.queryByTestId('start-a-1')).not.toBeInTheDocument();
  });

  it('moves a confirmed appointment through start and complete', async () => {
    vi.mocked(api.listAppointments).mockResolvedValue([appointment({ status: 'CONFIRMED' })]);
    vi.mocked(api.actOnAppointment).mockResolvedValue(appointment({ status: 'IN_SERVICE' }));
    wrap(<MechanicAppointments />);

    await userEvent.click(await screen.findByTestId('start-a-1'));
    await waitFor(() => expect(api.actOnAppointment).toHaveBeenCalledWith('a-1', 'start'));
    expect(await screen.findByTestId('complete-a-1')).toBeInTheDocument();
  });

  it('quotes a custom request', async () => {
    vi.mocked(api.listAppointments).mockResolvedValue([
      appointment({ service_type: 'CUSTOM', service_name: 'Custom Service',
        status: 'REQUESTED', payment_status: 'NOT_REQUIRED', price_minor: null,
        description: 'Clutch slipping' })]);
    vi.mocked(api.quoteAppointment).mockResolvedValue(
      appointment({ status: 'QUOTED', price_minor: 250000 }));

    wrap(<MechanicAppointments />);
    await userEvent.type(await screen.findByTestId('quote-input-a-1'), '2500');
    await userEvent.click(screen.getByTestId('send-quote-a-1'));

    await waitFor(() => expect(api.quoteAppointment).toHaveBeenCalledWith('a-1', 2500));
  });

  it('does not offer a quotation box for a fixed-price service', async () => {
    vi.mocked(api.listAppointments).mockResolvedValue([
      appointment({ status: 'PAYMENT_CONFIRMED' })]);
    wrap(<MechanicAppointments />);
    await screen.findByTestId('mechanic-appointment-a-1');
    expect(screen.queryByTestId('quote-input-a-1')).not.toBeInTheDocument();
  });

  // Refunds: the mechanic can start one only while it is genuinely owed, and
  // the UI never claims the money is back before the gateway confirms it.
  it('offers a refund only when one is owed', async () => {
    vi.mocked(api.listAppointments).mockResolvedValue([
      appointment({ status: 'DECLINED', payment_status: 'REFUND_PENDING' })]);
    vi.mocked(api.refundAppointment).mockResolvedValue(
      appointment({ status: 'DECLINED', payment_status: 'REFUND_INITIATED' }));
    wrap(<MechanicAppointments />);

    await userEvent.click(await screen.findByTestId('refund-a-1'));

    await waitFor(() => expect(api.refundAppointment).toHaveBeenCalledWith('a-1'));
    // "on the way", not "refunded".
    expect(await screen.findByText(/Refund on the way/)).toBeInTheDocument();
    expect(screen.queryByTestId('refund-a-1')).not.toBeInTheDocument();
  });

  it('does not offer a refund on a paid appointment that owes none', async () => {
    vi.mocked(api.listAppointments).mockResolvedValue([
      appointment({ status: 'CONFIRMED', payment_status: 'PAID' })]);
    wrap(<MechanicAppointments />);
    await screen.findByTestId('mechanic-appointment-a-1');
    expect(screen.queryByTestId('refund-a-1')).not.toBeInTheDocument();
  });

  it('lets a failed refund be retried', async () => {
    vi.mocked(api.listAppointments).mockResolvedValue([
      appointment({ status: 'DECLINED', payment_status: 'REFUND_FAILED' })]);
    wrap(<MechanicAppointments />);
    expect(await screen.findByTestId('refund-a-1')).toHaveTextContent('Retry refund');
  });

  it('shows an empty state with no appointments', async () => {
    wrap(<MechanicAppointments />);
    expect(await screen.findByTestId('mechanic-upcoming-empty')).toBeInTheDocument();
  });
});
