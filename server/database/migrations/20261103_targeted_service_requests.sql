ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS target_provider_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_target_provider
  ON opportunities(target_provider_id, status, expires_at);

UPDATE opportunities o
SET target_provider_id = s.provider_id
FROM services s
JOIN profiles p ON p.user_id = s.provider_id
WHERE o.target_provider_id IS NULL
  AND o.title = 'Request: ' || s.title
  AND o.description LIKE '% from ' || p.first_name || ' ' || p.last_name || '.%';
