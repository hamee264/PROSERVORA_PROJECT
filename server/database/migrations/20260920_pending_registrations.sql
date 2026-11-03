BEGIN;

-- ============================================================
-- PENDING REGISTRATIONS
-- ============================================================
-- Users are NOT inserted into the users table until their
-- email verification code has been successfully confirmed.

CREATE TABLE IF NOT EXISTS pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  email VARCHAR(254) NOT NULL UNIQUE,

  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,

  password_hash TEXT NOT NULL,

  role VARCHAR(20) NOT NULL
    CHECK (role IN ('customer', 'provider')),

  code_hash TEXT NOT NULL,

  expires_at TIMESTAMPTZ NOT NULL,

  attempts INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
idx_pending_registrations_expires_at
ON pending_registrations (expires_at);

COMMIT;