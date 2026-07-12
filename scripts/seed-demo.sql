-- =============================================================================
-- RateAnything Demo Seed Data
-- Idempotent: safe to run multiple times (ON CONFLICT DO NOTHING)
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. INSERT USERS
-- =============================================================================
INSERT INTO users (clerk_id, username, bio) VALUES
  ('user_test_alex', 'alex', 'Sports fan, tough critic'),
  ('user_test_sam', 'sam', 'Contrarian takes only'),
  ('user_test_jordan', 'jordan', 'Casual browser turned rater')
ON CONFLICT (clerk_id) DO NOTHING;

-- =============================================================================
-- 2. INSERT TOPICS
-- =============================================================================

-- Topic 1: Rate the iPhone 16 Pro (Tech)
INSERT INTO topics (title, slug, description, category_id, creator_id, status)
VALUES (
  'Rate the iPhone 16 Pro',
  'rate-the-iphone-16-pro',
  'Apple''s latest flagship — worth the upgrade or just a camera bump? Rate each aspect.',
  (SELECT id FROM categories WHERE slug = 'tech'),
  (SELECT id FROM users WHERE username = 'admin'),
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- Topic 2: Rate The Bear Season 4 (Movies and TV)
INSERT INTO topics (title, slug, description, category_id, creator_id, status)
VALUES (
  'Rate The Bear Season 4',
  'rate-the-bear-season-4',
  'Carmy is back in the kitchen. Did Season 4 deliver or did it lose the plot?',
  (SELECT id FROM categories WHERE slug = 'movies-tv'),
  (SELECT id FROM users WHERE username = 'alex'),
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- Topic 3: Rate Jayson Tatum Game 7 Performance (Sports)
INSERT INTO topics (title, slug, description, category_id, creator_id, status)
VALUES (
  'Rate Jayson Tatum Game 7 Performance',
  'rate-jayson-tatum-game-7-performance',
  'The biggest game of the season. Who showed up and who disappeared?',
  (SELECT id FROM categories WHERE slug = 'sports'),
  (SELECT id FROM users WHERE username = 'alex'),
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- Topic 4: Best Fast Food Burger (Food)
INSERT INTO topics (title, slug, description, category_id, creator_id, status)
VALUES (
  'Best Fast Food Burger',
  'best-fast-food-burger',
  'The eternal debate. Which chain actually makes the best burger?',
  (SELECT id FROM categories WHERE slug = 'food'),
  (SELECT id FROM users WHERE username = 'sam'),
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- Topic 5: Rate the AI Hype (Culture)
INSERT INTO topics (title, slug, description, category_id, creator_id, status)
VALUES (
  'Rate the AI Hype',
  'rate-the-ai-hype',
  'Everyone has opinions about AI. Rate the major players — overhyped or underrated?',
  (SELECT id FROM categories WHERE slug = 'culture'),
  (SELECT id FROM users WHERE username = 'jordan'),
  'active'
) ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 3. INSERT OPTIONS
-- =============================================================================

-- iPhone 16 Pro options
INSERT INTO options (topic_id, name, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'rate-the-iphone-16-pro'), 'Design', 1),
  ((SELECT id FROM topics WHERE slug = 'rate-the-iphone-16-pro'), 'Camera', 2),
  ((SELECT id FROM topics WHERE slug = 'rate-the-iphone-16-pro'), 'Battery Life', 3),
  ((SELECT id FROM topics WHERE slug = 'rate-the-iphone-16-pro'), 'AI Features', 4),
  ((SELECT id FROM topics WHERE slug = 'rate-the-iphone-16-pro'), 'Value for Money', 5)
ON CONFLICT (topic_id, name) DO NOTHING;

-- The Bear Season 4 options
INSERT INTO options (topic_id, name, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'rate-the-bear-season-4'), 'Acting', 1),
  ((SELECT id FROM topics WHERE slug = 'rate-the-bear-season-4'), 'Story', 2),
  ((SELECT id FROM topics WHERE slug = 'rate-the-bear-season-4'), 'Pacing', 3),
  ((SELECT id FROM topics WHERE slug = 'rate-the-bear-season-4'), 'Finale', 4),
  ((SELECT id FROM topics WHERE slug = 'rate-the-bear-season-4'), 'Overall', 5)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Jayson Tatum Game 7 options
INSERT INTO options (topic_id, name, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'rate-jayson-tatum-game-7-performance'), 'Jayson Tatum', 1),
  ((SELECT id FROM topics WHERE slug = 'rate-jayson-tatum-game-7-performance'), 'Jaylen Brown', 2),
  ((SELECT id FROM topics WHERE slug = 'rate-jayson-tatum-game-7-performance'), 'Derrick White', 3)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Best Fast Food Burger options
INSERT INTO options (topic_id, name, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-fast-food-burger'), 'In-N-Out', 1),
  ((SELECT id FROM topics WHERE slug = 'best-fast-food-burger'), 'Shake Shack', 2),
  ((SELECT id FROM topics WHERE slug = 'best-fast-food-burger'), 'Five Guys', 3),
  ((SELECT id FROM topics WHERE slug = 'best-fast-food-burger'), 'Whataburger', 4)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Rate the AI Hype options
INSERT INTO options (topic_id, name, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'rate-the-ai-hype'), 'ChatGPT', 1),
  ((SELECT id FROM topics WHERE slug = 'rate-the-ai-hype'), 'Claude', 2),
  ((SELECT id FROM topics WHERE slug = 'rate-the-ai-hype'), 'Gemini', 3),
  ((SELECT id FROM topics WHERE slug = 'rate-the-ai-hype'), 'Open Source LLMs', 4)
ON CONFLICT (topic_id, name) DO NOTHING;

-- =============================================================================
-- 4. INSERT RATINGS
-- =============================================================================

-- Helper: Using subqueries for user_id and option_id
-- Format: (option_id, user_id, score, comment, tags)

-- --- iPhone 16 Pro Ratings ---
-- Design
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Design' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='admin'), 8, 'Titanium feels premium but basically same design since iPhone 12', '{}'),
  ((SELECT id FROM options WHERE name='Design' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='alex'), 7, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Design' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='sam'), 5, 'It looks like every other iPhone. Where is the innovation?', '{hot_take}'),
  ((SELECT id FROM options WHERE name='Design' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='jordan'), 9, NULL, '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Camera
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Camera' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='admin'), 9, 'The 5x telephoto is genuinely game-changing for street photography', '{}'),
  ((SELECT id FROM options WHERE name='Camera' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='alex'), 8, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Camera' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='sam'), 10, 'Best phone camera ever made, period', '{}'),
  ((SELECT id FROM options WHERE name='Camera' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='jordan'), 7, NULL, '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Battery Life
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Battery Life' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='admin'), 6, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Battery Life' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='alex'), 7, 'Gets me through a full day, barely', '{}'),
  ((SELECT id FROM options WHERE name='Battery Life' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='sam'), 4, 'Still charging by 3pm. Unacceptable at this price point.', '{overrated}'),
  ((SELECT id FROM options WHERE name='Battery Life' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='jordan'), 6, NULL, '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- AI Features
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='AI Features' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='admin'), 4, 'Apple Intelligence is half-baked. Siri is still embarrassing.', '{}'),
  ((SELECT id FROM options WHERE name='AI Features' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='alex'), 5, NULL, '{}'),
  ((SELECT id FROM options WHERE name='AI Features' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='sam'), 2, 'Literally vaporware at launch. Apple sold a promise not a product.', '{hot_take}'),
  ((SELECT id FROM options WHERE name='AI Features' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='jordan'), 6, 'Writing tools are actually handy for emails', '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Value for Money
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Value for Money' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='admin'), 5, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Value for Money' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='alex'), 6, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Value for Money' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='sam'), 3, '$1200 for an incremental update is wild', '{overrated}'),
  ((SELECT id FROM options WHERE name='Value for Money' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-iphone-16-pro')),
   (SELECT id FROM users WHERE username='jordan'), 7, 'If you''re coming from an older phone, it''s worth it', '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- --- The Bear Season 4 Ratings ---
-- Acting
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Acting' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='admin'), 10, 'Jeremy Allen White deserves every award. The man IS Carmy.', '{}'),
  ((SELECT id FROM options WHERE name='Acting' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='alex'), 9, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Acting' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='sam'), 8, 'Ayo Edebiri carried this season more than White tbh', '{hot_take}'),
  ((SELECT id FROM options WHERE name='Acting' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='jordan'), 9, NULL, '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Story
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Story' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='admin'), 7, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Story' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='alex'), 6, 'They keep teasing the Carmy-Claire thing and going nowhere', '{}'),
  ((SELECT id FROM options WHERE name='Story' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='sam'), 5, 'Style over substance. Beautiful shots, empty calories.', '{overrated}'),
  ((SELECT id FROM options WHERE name='Story' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='jordan'), 8, NULL, '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Pacing
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Pacing' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='admin'), 5, 'Episode 6 was a 45-minute montage. Felt like filler.', '{}'),
  ((SELECT id FROM options WHERE name='Pacing' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='alex'), 6, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Pacing' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='sam'), 3, 'Slowest season by far. I nearly quit at episode 4.', '{}'),
  ((SELECT id FROM options WHERE name='Pacing' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='jordan'), 7, 'Slow burn is fine if the payoff is there', '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Finale
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Finale' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='admin'), 8, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Finale' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='alex'), 9, 'That last scene wrecked me. Unexpected gut punch.', '{}'),
  ((SELECT id FROM options WHERE name='Finale' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='sam'), 7, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Finale' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='jordan'), 8, NULL, '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Overall
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Overall' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='admin'), 8, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Overall' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='alex'), 7, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Overall' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='sam'), 6, 'Season 2 was the peak. Everything after is diminishing returns.', '{}'),
  ((SELECT id FROM options WHERE name='Overall' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-bear-season-4')),
   (SELECT id FROM users WHERE username='jordan'), 8, NULL, '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- --- Jayson Tatum Game 7 Ratings ---
-- Jayson Tatum
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Jayson Tatum' AND topic_id=(SELECT id FROM topics WHERE slug='rate-jayson-tatum-game-7-performance')),
   (SELECT id FROM users WHERE username='admin'), 6, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Jayson Tatum' AND topic_id=(SELECT id FROM topics WHERE slug='rate-jayson-tatum-game-7-performance')),
   (SELECT id FROM users WHERE username='alex'), 5, 'Disappeared in the 4th quarter when it mattered most', '{}'),
  ((SELECT id FROM options WHERE name='Jayson Tatum' AND topic_id=(SELECT id FROM topics WHERE slug='rate-jayson-tatum-game-7-performance')),
   (SELECT id FROM users WHERE username='sam'), 3, 'Not a top 5 player until he shows up in elimination games', '{hot_take}'),
  ((SELECT id FROM options WHERE name='Jayson Tatum' AND topic_id=(SELECT id FROM topics WHERE slug='rate-jayson-tatum-game-7-performance')),
   (SELECT id FROM users WHERE username='jordan'), 7, 'Still had 28 points... people expect perfection', '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Jaylen Brown
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Jaylen Brown' AND topic_id=(SELECT id FROM topics WHERE slug='rate-jayson-tatum-game-7-performance')),
   (SELECT id FROM users WHERE username='admin'), 9, 'Clutch gene is REAL. Hit the dagger three.', '{}'),
  ((SELECT id FROM options WHERE name='Jaylen Brown' AND topic_id=(SELECT id FROM topics WHERE slug='rate-jayson-tatum-game-7-performance')),
   (SELECT id FROM users WHERE username='alex'), 9, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Jaylen Brown' AND topic_id=(SELECT id FROM topics WHERE slug='rate-jayson-tatum-game-7-performance')),
   (SELECT id FROM users WHERE username='sam'), 10, 'Best player on the Celtics and it''s not close', '{hot_take}'),
  ((SELECT id FROM options WHERE name='Jaylen Brown' AND topic_id=(SELECT id FROM topics WHERE slug='rate-jayson-tatum-game-7-performance')),
   (SELECT id FROM users WHERE username='jordan'), 8, NULL, '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Derrick White
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Derrick White' AND topic_id=(SELECT id FROM topics WHERE slug='rate-jayson-tatum-game-7-performance')),
   (SELECT id FROM users WHERE username='admin'), 8, 'The hustle plays don''t show up in the box score', '{}'),
  ((SELECT id FROM options WHERE name='Derrick White' AND topic_id=(SELECT id FROM topics WHERE slug='rate-jayson-tatum-game-7-performance')),
   (SELECT id FROM users WHERE username='alex'), 8, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Derrick White' AND topic_id=(SELECT id FROM topics WHERE slug='rate-jayson-tatum-game-7-performance')),
   (SELECT id FROM users WHERE username='sam'), 7, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Derrick White' AND topic_id=(SELECT id FROM topics WHERE slug='rate-jayson-tatum-game-7-performance')),
   (SELECT id FROM users WHERE username='jordan'), 9, 'Most underrated player in the league right now', '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- --- Best Fast Food Burger Ratings ---
-- In-N-Out
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='In-N-Out' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='admin'), 8, 'Animal style fries are the real star', '{}'),
  ((SELECT id FROM options WHERE name='In-N-Out' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='alex'), 9, NULL, '{}'),
  ((SELECT id FROM options WHERE name='In-N-Out' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='sam'), 4, 'Most overrated fast food in America. It''s just a thin patty.', '{overrated}'),
  ((SELECT id FROM options WHERE name='In-N-Out' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='jordan'), 7, NULL, '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Shake Shack
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Shake Shack' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='admin'), 7, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Shake Shack' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='alex'), 6, 'Good but overpriced for what you get', '{}'),
  ((SELECT id FROM options WHERE name='Shake Shack' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='sam'), 8, 'ShackBurger is objectively the best fast casual burger', '{}'),
  ((SELECT id FROM options WHERE name='Shake Shack' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='jordan'), 7, NULL, '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Five Guys
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Five Guys' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='admin'), 7, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Five Guys' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='alex'), 8, 'The cajun fries alone are worth the trip', '{}'),
  ((SELECT id FROM options WHERE name='Five Guys' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='sam'), 6, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Five Guys' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='jordan'), 7, NULL, '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Whataburger
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Whataburger' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='admin'), 6, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Whataburger' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='alex'), 7, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Whataburger' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='sam'), 9, 'Texas knows burgers. Patty melt is elite.', '{}'),
  ((SELECT id FROM options WHERE name='Whataburger' AND topic_id=(SELECT id FROM topics WHERE slug='best-fast-food-burger')),
   (SELECT id FROM users WHERE username='jordan'), 5, 'Tried it once, didn''t get the hype', '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- --- Rate the AI Hype Ratings ---
-- ChatGPT
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='ChatGPT' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='admin'), 7, 'First mover advantage but the quality has plateaued', '{}'),
  ((SELECT id FROM options WHERE name='ChatGPT' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='alex'), 8, NULL, '{}'),
  ((SELECT id FROM options WHERE name='ChatGPT' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='sam'), 5, 'Living off brand recognition at this point', '{overrated}'),
  ((SELECT id FROM options WHERE name='ChatGPT' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='jordan'), 7, NULL, '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Claude
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Claude' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='admin'), 9, 'Best for actual coding and long-form writing. Not even close.', '{}'),
  ((SELECT id FROM options WHERE name='Claude' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='alex'), 7, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Claude' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='sam'), 8, 'Underrated. The safety stuff is annoying but the output quality is top tier.', '{}'),
  ((SELECT id FROM options WHERE name='Claude' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='jordan'), 8, 'My daily driver for work', '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Gemini
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Gemini' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='admin'), 6, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Gemini' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='alex'), 5, 'Google has infinite data and still can''t make it feel polished', '{}'),
  ((SELECT id FROM options WHERE name='Gemini' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='sam'), 4, 'Bard rebrand energy. All marketing no substance.', '{hot_take}'),
  ((SELECT id FROM options WHERE name='Gemini' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='jordan'), 6, NULL, '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- Open Source LLMs
INSERT INTO ratings (option_id, user_id, score, comment, tags) VALUES
  ((SELECT id FROM options WHERE name='Open Source LLMs' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='admin'), 7, 'Llama 3 is impressive but you need serious hardware', '{}'),
  ((SELECT id FROM options WHERE name='Open Source LLMs' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='alex'), 6, NULL, '{}'),
  ((SELECT id FROM options WHERE name='Open Source LLMs' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='sam'), 10, 'The future is open. In 2 years closed models will be irrelevant.', '{hot_take}'),
  ((SELECT id FROM options WHERE name='Open Source LLMs' AND topic_id=(SELECT id FROM topics WHERE slug='rate-the-ai-hype')),
   (SELECT id FROM users WHERE username='jordan'), 5, 'Cool in theory but regular people won''t run local models', '{}')
ON CONFLICT (user_id, option_id) DO NOTHING;

-- =============================================================================
-- 5. INSERT COMMENTS (on interesting ratings)
-- =============================================================================

-- Comment on Sam's hot take about In-N-Out
INSERT INTO comments (rating_id, user_id, content) VALUES
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id
    WHERE t.slug='best-fast-food-burger' AND o.name='In-N-Out' AND r.user_id=(SELECT id FROM users WHERE username='sam')),
   (SELECT id FROM users WHERE username='alex'),
   'Tell me you''re from the East Coast without telling me you''re from the East Coast 😂')
ON CONFLICT DO NOTHING;

-- Comment on Sam's Tatum hot take
INSERT INTO comments (rating_id, user_id, content) VALUES
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id
    WHERE t.slug='rate-jayson-tatum-game-7-performance' AND o.name='Jayson Tatum' AND r.user_id=(SELECT id FROM users WHERE username='sam')),
   (SELECT id FROM users WHERE username='admin'),
   'This is insane. The man averages 27/8/5 in the playoffs. What more do you want?')
ON CONFLICT DO NOTHING;

-- Comment on admin's Bear acting rating
INSERT INTO comments (rating_id, user_id, content) VALUES
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id
    WHERE t.slug='rate-the-bear-season-4' AND o.name='Acting' AND r.user_id=(SELECT id FROM users WHERE username='admin')),
   (SELECT id FROM users WHERE username='jordan'),
   'The one-shot kitchen scene in episode 3 was absolutely insane. How did they even film that?')
ON CONFLICT DO NOTHING;

-- Comment on admin's Claude rating
INSERT INTO comments (rating_id, user_id, content) VALUES
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id
    WHERE t.slug='rate-the-ai-hype' AND o.name='Claude' AND r.user_id=(SELECT id FROM users WHERE username='admin')),
   (SELECT id FROM users WHERE username='sam'),
   'Based. Switched from GPT-4 last month and haven''t looked back.')
ON CONFLICT DO NOTHING;

-- Comment on Sam's open source hot take
INSERT INTO comments (rating_id, user_id, content) VALUES
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id
    WHERE t.slug='rate-the-ai-hype' AND o.name='Open Source LLMs' AND r.user_id=(SELECT id FROM users WHERE username='sam')),
   (SELECT id FROM users WHERE username='admin'),
   'Respectfully disagree. The gap between open and closed models is growing, not shrinking.')
ON CONFLICT DO NOTHING;

-- Comment on Sam's battery life complaint
INSERT INTO comments (rating_id, user_id, content) VALUES
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id
    WHERE t.slug='rate-the-iphone-16-pro' AND o.name='Battery Life' AND r.user_id=(SELECT id FROM users WHERE username='sam')),
   (SELECT id FROM users WHERE username='jordan'),
   'Do you have like 47 apps running in the background? Mine easily lasts till evening')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 6. UPDATE DENORMALIZED FIELDS
-- =============================================================================

-- Update options.avg_rating and options.rating_count
UPDATE options SET
  avg_rating = sub.avg_score,
  rating_count = sub.cnt
FROM (
  SELECT option_id, AVG(score)::double precision AS avg_score, COUNT(*)::integer AS cnt
  FROM ratings
  GROUP BY option_id
) sub
WHERE options.id = sub.option_id;

-- Update topics.total_ratings
UPDATE topics SET
  total_ratings = sub.total,
  trending_score = sub.total * 1.5,
  last_activity = NOW()
FROM (
  SELECT o.topic_id, SUM(o.rating_count)::integer AS total
  FROM options o
  GROUP BY o.topic_id
) sub
WHERE topics.id = sub.topic_id;

-- Update users.rating_count
UPDATE users SET
  rating_count = sub.cnt
FROM (
  SELECT user_id, COUNT(*)::integer AS cnt
  FROM ratings
  WHERE user_id IS NOT NULL
  GROUP BY user_id
) sub
WHERE users.id = sub.user_id;

COMMIT;
