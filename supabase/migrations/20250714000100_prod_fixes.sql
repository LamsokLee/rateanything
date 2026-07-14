CREATE UNIQUE INDEX IF NOT EXISTS one_rating_per_user ON ratings (user_id, option_id);
CREATE UNIQUE INDEX IF NOT EXISTS one_rating_per_guest ON ratings (guest_id, option_id);
ALTER TABLE options ADD COLUMN IF NOT EXISTS rating_sum bigint NOT NULL DEFAULT 0;
UPDATE options o SET rating_sum = COALESCE((SELECT SUM(score) FROM ratings WHERE option_id = o.id), 0);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
