/**
 * Opening the payment gateway's checkout.
 *
 * Two providers, one contract: whatever happens here, the result is verified
 * server-side by `/appointments/{id}/payment-confirm`. A dismissed or failed
 * checkout resolves to `null` — this module never reports a success the gateway
 * did not give it.
 */
import { apiFetchData } from './api';
import type { PaymentOrder } from './appointments';

export interface CheckoutResult {
  order_id: string;
  payment_id: string;
  signature: string;
}

interface CheckoutOptions {
  name: string;
  description: string;
  appointmentId: string;
}

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load checkout.')));
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load checkout.'));
    document.body.appendChild(script);
  });
}

/**
 * Resolves with the gateway's signed result, or `null` if the customer
 * dismissed checkout without paying.
 */
export async function openCheckout(
  order: PaymentOrder, options: CheckoutOptions,
): Promise<CheckoutResult | null> {
  if (order.provider !== 'razorpay') {
    // The stub gateway has no checkout UI and signs server-side. This asks the
    // backend for the payload checkout would have produced; the result still
    // goes through the same signature verification as a live payment, and the
    // endpoint does not exist once real keys are configured.
    return apiFetchData<CheckoutResult>(
      `/appointments/${options.appointmentId}/payment-simulate`, { method: 'POST' },
    );
  }

  await loadRazorpay();
  return new Promise<CheckoutResult | null>((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('Checkout is unavailable right now.'));
      return;
    }
    const checkout = new window.Razorpay({
      key: order.public_key,
      order_id: order.order_id,
      amount: order.amount_minor,
      currency: order.currency,
      name: options.name,
      description: options.description,
      handler: (response: Record<string, string>) => resolve({
        order_id: response.razorpay_order_id,
        payment_id: response.razorpay_payment_id,
        signature: response.razorpay_signature,
      }),
      // Dismissing checkout is not a failure to shout about — the appointment
      // keeps its slot and the customer can pay from their appointments page.
      modal: { ondismiss: () => resolve(null) },
    });
    checkout.open();
  });
}
