BEGIN;

-- ============================================================
-- ACTIVE BOOKING PROTECTION
-- ============================================================
--
-- A provider can only have one active application/booking
-- against the same opportunity.
--
-- Historical completed/cancelled/refunded bookings are NOT
-- affected by this constraint.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
uq_bookings_active_provider_application
ON bookings (
  opportunity_id,
  provider_id
)
WHERE status IN (
  'pending',
  'accepted',
  'in_progress'
);


-- ============================================================
-- BOOKING LOOKUP INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
idx_bookings_customer_status_created
ON bookings (
  customer_id,
  status,
  created_at DESC
);


CREATE INDEX IF NOT EXISTS
idx_bookings_provider_status_created
ON bookings (
  provider_id,
  status,
  created_at DESC
);


CREATE INDEX IF NOT EXISTS
idx_bookings_opportunity_status
ON bookings (
  opportunity_id,
  status
);


-- ============================================================
-- PAYMENT LOOKUP
-- ============================================================

CREATE INDEX IF NOT EXISTS
idx_payments_booking_status
ON payments (
  booking_id,
  status
);


COMMIT;