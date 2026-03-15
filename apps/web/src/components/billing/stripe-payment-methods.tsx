'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useApiClient } from '@/lib/api-client.client';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

type PaymentMethodSummary = {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

type BillingResponse = {
  customerId?: string;
  defaultPaymentMethodId?: string;
  paymentMethods: PaymentMethodSummary[];
};

function PaymentMethodForm({
  onCancel,
  onPaymentMethodSaved,
}: {
  onCancel: () => void;
  onPaymentMethodSaved: (paymentMethodId: string) => Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      setError('Stripe is still loading. Please try again in a moment.');
      return;
    }

    setSubmitting(true);

    const result = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message || 'Unable to save payment method.');
      setSubmitting(false);
      return;
    }

    const paymentMethodId = result.setupIntent?.payment_method;
    if (typeof paymentMethodId === 'string') {
      await onPaymentMethodSaved(paymentMethodId);
    } else {
      setError('Payment method confirmation failed. Please try again.');
    }

    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4">
      <PaymentElement />
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Payment method error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!stripe || submitting}>
          {submitting ? 'Saving...' : 'Save payment method'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function StripePaymentMethods() {
  const { apiGet, apiPost } = useApiClient();
  const [billingInfo, setBillingInfo] = useState<BillingResponse>({
    paymentMethods: [],
  });
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [savingDefault, setSavingDefault] = useState<string | null>(null);

  const loadPaymentMethods = useCallback(async () => {
    setLoading(true);
    setActionError(null);

    try {
      const response = await apiGet<BillingResponse>('/api/billing/payment-methods');
      setBillingInfo(response);
    } catch (error) {
      console.error('Failed to load payment methods', error);
      setActionError(error instanceof Error ? error.message : 'Unable to load payment methods.');
    } finally {
      setLoading(false);
    }
  }, [apiGet]);

  useEffect(() => {
    if (!stripePromise) {
      setLoading(false);
      return;
    }
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  const startSetupIntent = async () => {
    setActionError(null);
    try {
      const response = await apiPost<{ clientSecret: string }>(
        '/api/billing/setup-intent',
        {}
      );
      setClientSecret(response.clientSecret);
    } catch (error) {
      console.error('Failed to create setup intent', error);
      setActionError(error instanceof Error ? error.message : 'Unable to start payment method setup.');
    }
  };

  const handlePaymentMethodSaved = async (paymentMethodId: string) => {
    try {
      await apiPost('/api/billing/default-payment-method', {
        paymentMethodId,
      });
      setClientSecret(null);
      await loadPaymentMethods();
    } catch (error) {
      console.error('Failed to set default payment method', error);
      setActionError(error instanceof Error ? error.message : 'Payment method saved, but default update failed.');
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    setSavingDefault(paymentMethodId);
    setActionError(null);

    try {
      await apiPost('/api/billing/default-payment-method', { paymentMethodId });
      await loadPaymentMethods();
    } catch (error) {
      console.error('Failed to set default payment method', error);
      setActionError(error instanceof Error ? error.message : 'Unable to update default payment method.');
    } finally {
      setSavingDefault(null);
    }
  };

  if (!stripePromise) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Stripe not configured</AlertTitle>
        <AlertDescription>
          Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable payment methods.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <Alert variant="destructive">
          <AlertTitle>Billing update failed</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading payment methods...</p>
      ) : billingInfo.paymentMethods.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No payment methods saved yet. Add one to enable billing.
        </p>
      ) : (
        <div className="space-y-3">
          {billingInfo.paymentMethods.map((method) => (
            <div key={method.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="font-medium capitalize">
                  {method.brand ?? 'Card'} •••• {method.last4 ?? '----'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Expires {method.expMonth ?? '--'}/{method.expYear ?? '--'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {billingInfo.defaultPaymentMethodId === method.id ? (
                  <Badge variant="secondary">Default</Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetDefault(method.id)}
                    disabled={savingDefault === method.id}
                  >
                    {savingDefault === method.id ? 'Saving...' : 'Make default'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentMethodForm
            onCancel={() => setClientSecret(null)}
            onPaymentMethodSaved={handlePaymentMethodSaved}
          />
        </Elements>
      ) : (
        <Button variant="outline" onClick={startSetupIntent}>
          Add payment method
        </Button>
      )}
    </div>
  );
}
