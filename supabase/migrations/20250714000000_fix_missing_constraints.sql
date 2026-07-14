-- Add missing rating_sum column to options
ALTER TABLE options ADD COLUMN IF NOT EXISTS rating_sum bigint NOT NULL DEFAULT 0;

-- Backfill rating_sum from existing ratings
UPDATE options o SET rating_sum = COALESCE((SELECT SUM(score) FROM ratings WHERE option_id = o.id), 0);

-- Add missing is_deleted column to comments
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- Unique constraint for authenticated user ratings (for upsert)
CREATE UNIQUE INDEX IF NOT EXISTS ratings_user_option_unique ON ratings (user_id, option_id) WHERE user_id IS NOT NULL;

-- Unique constraint for guest ratings (for upsert)
CREATE UNIQUE INDEX IF NOT EXISTS ratings_guest_option_unique ON ratings (guest_id, option_id) WHERE guest_id IS NOT NULL;
