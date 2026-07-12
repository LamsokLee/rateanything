-- Spread existing ratings across the last 7 days for chart history data.
-- This updates all ratings so the time-series chart has meaningful data points.
UPDATE ratings SET created_at = NOW() - (random() * interval '7 days')
WHERE option_id IN (SELECT id FROM options);
