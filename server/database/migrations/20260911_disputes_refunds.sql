
BEGIN;

ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS previous_booking_status VARCHAR(30);

ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS resolved_by UUID
  REFERENCES users(id)
  ON DELETE RESTRICT;

ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS resolution_type VARCHAR(30);

ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_disputes_status_created
  ON disputes (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_disputes_booking
  ON disputes (booking_id);

CREATE TABLE IF NOT EXISTS dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL
    REFERENCES disputes(id)
    ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE RESTRICT,
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dispute_messages_message_check
    CHECK (length(trim(message)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute_created
  ON dispute_messages (dispute_id, created_at ASC);

CREATE TABLE IF NOT EXISTS payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL
    REFERENCES payments(id)
    ON DELETE RESTRICT,
  dispute_id UUID NOT NULL
    REFERENCES disputes(id)
    ON DELETE RESTRICT,
  amount NUMERIC NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  paystack_refund_id TEXT,
  transaction_reference TEXT,
  customer_note TEXT,
  merchant_note TEXT,
  expected_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT payment_refunds_amount_check
    CHECK (amount > 0),

  CONSTRAINT payment_refunds_status_check
    CHECK (
      status IN (
        'pending',
        'processing',
        'needs_attention',
        'processed',
        'failed'
      )
    ),

  CONSTRAINT uq_payment_refund_payment
    UNIQUE (payment_id),

  CONSTRAINT uq_payment_refund_dispute
    UNIQUE (dispute_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_status_updated
  ON payment_refunds (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_transaction_reference
  ON payment_refunds (transaction_reference);

COMMIT;




























\\




