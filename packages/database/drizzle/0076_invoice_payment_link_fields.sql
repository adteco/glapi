-- 0076_invoice_payment_link_fields.sql
-- Adds persisted Stripe hosted payment reference fields to invoices.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_link_url VARCHAR(2048),
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS invoices_stripe_checkout_session_id_idx
  ON invoices(stripe_checkout_session_id);

CREATE INDEX IF NOT EXISTS invoices_stripe_payment_intent_id_idx
  ON invoices(stripe_payment_intent_id);
