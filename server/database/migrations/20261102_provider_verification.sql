ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS residential_address TEXT,
  ADD COLUMN IF NOT EXISTS id_type TEXT,
  ADD COLUMN IF NOT EXISTS id_number TEXT,
  ADD COLUMN IF NOT EXISTS id_document_url TEXT;

UPDATE provider_profiles
SET verification_status = CASE
  WHEN is_verified = true THEN 'verified'
  ELSE COALESCE(NULLIF(verification_status, ''), 'pending')
END
WHERE verification_status IS NULL
   OR verification_status = '';

ALTER TABLE provider_profiles
  DROP CONSTRAINT IF EXISTS provider_profiles_verification_status_check;

ALTER TABLE provider_profiles
  ADD CONSTRAINT provider_profiles_verification_status_check
  CHECK (verification_status IN ('pending', 'submitted', 'verified', 'rejected'));
