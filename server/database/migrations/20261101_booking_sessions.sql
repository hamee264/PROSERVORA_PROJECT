BEGIN;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS session_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS session_details TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_session_duration_check'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_session_duration_check
      CHECK (
        session_duration_minutes IS NULL
        OR session_duration_minutes BETWEEN 15 AND 1440
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_session_start
  ON bookings (session_start_at)
  WHERE session_start_at IS NOT NULL;

COMMIT;
