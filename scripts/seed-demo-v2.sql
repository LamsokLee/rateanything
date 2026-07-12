-- =============================================================================
-- RateAnything Demo Seed Data v2 - Fun Head-to-Head Comparison Topics
-- =============================================================================

BEGIN;

-- Delete existing demo data (keep users and categories)
DELETE FROM comments;
DELETE FROM ratings;
DELETE FROM options;
DELETE FROM topics;

-- =============================================================================
-- TOPICS
-- =============================================================================

INSERT INTO topics (title, slug, description, category_id, creator_id, status) VALUES
  ('Greatest iPhone of All Time', 'greatest-iphone-of-all-time', 'From the revolutionary iPhone 4 to the latest Pro models - which iPhone defined a generation?', (SELECT id FROM categories WHERE slug = 'tech'), (SELECT id FROM users WHERE username = 'admin'), 'active'),
  ('Best Fast Food Chain', 'best-fast-food-chain', 'The ultimate fast food showdown. Which chain reigns supreme?', (SELECT id FROM categories WHERE slug = 'food'), (SELECT id FROM users WHERE username = 'sam'), 'active'),
  ('Best NBA Player Right Now', 'best-nba-player-right-now', 'Forget legacy - who is the best player in the NBA today?', (SELECT id FROM categories WHERE slug = 'sports'), (SELECT id FROM users WHERE username = 'alex'), 'active'),
  ('Best AI Model 2026', 'best-ai-model-2026', 'The AI wars are heating up. Which model actually delivers?', (SELECT id FROM categories WHERE slug = 'culture'), (SELECT id FROM users WHERE username = 'jordan'), 'active'),
  ('Best Streaming Service', 'best-streaming-service', 'Too many subscriptions, not enough time. Which one is actually worth paying for?', (SELECT id FROM categories WHERE slug = 'movies-tv'), (SELECT id FROM users WHERE username = 'admin'), 'active');

-- =============================================================================
-- OPTIONS
-- =============================================================================

-- Greatest iPhone of All Time
INSERT INTO options (topic_id, name, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'greatest-iphone-of-all-time'), 'iPhone 4', 1),
  ((SELECT id FROM topics WHERE slug = 'greatest-iphone-of-all-time'), 'iPhone 5s', 2),
  ((SELECT id FROM topics WHERE slug = 'greatest-iphone-of-all-time'), 'iPhone 6', 3),
  ((SELECT id FROM topics WHERE slug = 'greatest-iphone-of-all-time'), 'iPhone X', 4),
  ((SELECT id FROM topics WHERE slug = 'greatest-iphone-of-all-time'), 'iPhone 12', 5),
  ((SELECT id FROM topics WHERE slug = 'greatest-iphone-of-all-time'), 'iPhone 15 Pro', 6),
  ((SELECT id FROM topics WHERE slug = 'greatest-iphone-of-all-time'), 'iPhone 16 Pro', 7);

-- Best Fast Food Chain
INSERT INTO options (topic_id, name, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-fast-food-chain'), 'In-N-Out', 1),
  ((SELECT id FROM topics WHERE slug = 'best-fast-food-chain'), 'Chick-fil-A', 2),
  ((SELECT id FROM topics WHERE slug = 'best-fast-food-chain'), 'Shake Shack', 3),
  ((SELECT id FROM topics WHERE slug = 'best-fast-food-chain'), 'Five Guys', 4),
  ((SELECT id FROM topics WHERE slug = 'best-fast-food-chain'), 'Whataburger', 5),
  ((SELECT id FROM topics WHERE slug = 'best-fast-food-chain'), 'McDonald''s', 6),
  ((SELECT id FROM topics WHERE slug = 'best-fast-food-chain'), 'Wendy''s', 7);

-- Best NBA Player Right Now
INSERT INTO options (topic_id, name, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-nba-player-right-now'), 'Luka Dončić', 1),
  ((SELECT id FROM topics WHERE slug = 'best-nba-player-right-now'), 'Nikola Jokić', 2),
  ((SELECT id FROM topics WHERE slug = 'best-nba-player-right-now'), 'Jayson Tatum', 3),
  ((SELECT id FROM topics WHERE slug = 'best-nba-player-right-now'), 'Shai Gilgeous-Alexander', 4),
  ((SELECT id FROM topics WHERE slug = 'best-nba-player-right-now'), 'Giannis Antetokounmpo', 5);

-- Best AI Model 2026
INSERT INTO options (topic_id, name, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-ai-model-2026'), 'GPT-5', 1),
  ((SELECT id FROM topics WHERE slug = 'best-ai-model-2026'), 'Claude 4', 2),
  ((SELECT id FROM topics WHERE slug = 'best-ai-model-2026'), 'Gemini Ultra', 3),
  ((SELECT id FROM topics WHERE slug = 'best-ai-model-2026'), 'Llama 4', 4),
  ((SELECT id FROM topics WHERE slug = 'best-ai-model-2026'), 'Grok 3', 5);

-- Best Streaming Service
INSERT INTO options (topic_id, name, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-streaming-service'), 'Netflix', 1),
  ((SELECT id FROM topics WHERE slug = 'best-streaming-service'), 'HBO Max', 2),
  ((SELECT id FROM topics WHERE slug = 'best-streaming-service'), 'Apple TV+', 3),
  ((SELECT id FROM topics WHERE slug = 'best-streaming-service'), 'Disney+', 4),
  ((SELECT id FROM topics WHERE slug = 'best-streaming-service'), 'Hulu', 5),
  ((SELECT id FROM topics WHERE slug = 'best-streaming-service'), 'Prime Video', 6);

-- =============================================================================
-- RATINGS - varied scores with controversy
-- =============================================================================

-- Helper macro: (option lookup, user lookup, score)

-- Greatest iPhone of All Time ratings
INSERT INTO ratings (option_id, user_id, score) VALUES
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 4'), (SELECT id FROM users WHERE username='admin'), 10),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 4'), (SELECT id FROM users WHERE username='alex'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 4'), (SELECT id FROM users WHERE username='sam'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 4'), (SELECT id FROM users WHERE username='jordan'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 5s'), (SELECT id FROM users WHERE username='admin'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 5s'), (SELECT id FROM users WHERE username='alex'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 5s'), (SELECT id FROM users WHERE username='sam'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 5s'), (SELECT id FROM users WHERE username='jordan'), 5),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 6'), (SELECT id FROM users WHERE username='admin'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 6'), (SELECT id FROM users WHERE username='alex'), 5),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 6'), (SELECT id FROM users WHERE username='sam'), 4),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 6'), (SELECT id FROM users WHERE username='jordan'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone X'), (SELECT id FROM users WHERE username='admin'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone X'), (SELECT id FROM users WHERE username='alex'), 10),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone X'), (SELECT id FROM users WHERE username='sam'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone X'), (SELECT id FROM users WHERE username='jordan'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 12'), (SELECT id FROM users WHERE username='admin'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 12'), (SELECT id FROM users WHERE username='alex'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 12'), (SELECT id FROM users WHERE username='sam'), 5),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 12'), (SELECT id FROM users WHERE username='jordan'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 15 Pro'), (SELECT id FROM users WHERE username='admin'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 15 Pro'), (SELECT id FROM users WHERE username='alex'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 15 Pro'), (SELECT id FROM users WHERE username='sam'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 15 Pro'), (SELECT id FROM users WHERE username='jordan'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 16 Pro'), (SELECT id FROM users WHERE username='admin'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 16 Pro'), (SELECT id FROM users WHERE username='alex'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 16 Pro'), (SELECT id FROM users WHERE username='sam'), 3),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 16 Pro'), (SELECT id FROM users WHERE username='jordan'), 5);

-- Best Fast Food Chain ratings
INSERT INTO ratings (option_id, user_id, score) VALUES
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='In-N-Out'), (SELECT id FROM users WHERE username='admin'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='In-N-Out'), (SELECT id FROM users WHERE username='alex'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='In-N-Out'), (SELECT id FROM users WHERE username='sam'), 4),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='In-N-Out'), (SELECT id FROM users WHERE username='jordan'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Chick-fil-A'), (SELECT id FROM users WHERE username='admin'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Chick-fil-A'), (SELECT id FROM users WHERE username='alex'), 10),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Chick-fil-A'), (SELECT id FROM users WHERE username='sam'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Chick-fil-A'), (SELECT id FROM users WHERE username='jordan'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Shake Shack'), (SELECT id FROM users WHERE username='admin'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Shake Shack'), (SELECT id FROM users WHERE username='alex'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Shake Shack'), (SELECT id FROM users WHERE username='sam'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Shake Shack'), (SELECT id FROM users WHERE username='jordan'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Five Guys'), (SELECT id FROM users WHERE username='admin'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Five Guys'), (SELECT id FROM users WHERE username='alex'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Five Guys'), (SELECT id FROM users WHERE username='sam'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Five Guys'), (SELECT id FROM users WHERE username='jordan'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Whataburger'), (SELECT id FROM users WHERE username='admin'), 5),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Whataburger'), (SELECT id FROM users WHERE username='alex'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Whataburger'), (SELECT id FROM users WHERE username='sam'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Whataburger'), (SELECT id FROM users WHERE username='jordan'), 4),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='McDonald''s'), (SELECT id FROM users WHERE username='admin'), 5),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='McDonald''s'), (SELECT id FROM users WHERE username='alex'), 4),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='McDonald''s'), (SELECT id FROM users WHERE username='sam'), 3),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='McDonald''s'), (SELECT id FROM users WHERE username='jordan'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Wendy''s'), (SELECT id FROM users WHERE username='admin'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Wendy''s'), (SELECT id FROM users WHERE username='alex'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Wendy''s'), (SELECT id FROM users WHERE username='sam'), 5),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Wendy''s'), (SELECT id FROM users WHERE username='jordan'), 6);

-- Best NBA Player Right Now ratings
INSERT INTO ratings (option_id, user_id, score) VALUES
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Luka Dončić'), (SELECT id FROM users WHERE username='admin'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Luka Dončić'), (SELECT id FROM users WHERE username='alex'), 10),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Luka Dončić'), (SELECT id FROM users WHERE username='sam'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Luka Dončić'), (SELECT id FROM users WHERE username='jordan'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Nikola Jokić'), (SELECT id FROM users WHERE username='admin'), 10),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Nikola Jokić'), (SELECT id FROM users WHERE username='alex'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Nikola Jokić'), (SELECT id FROM users WHERE username='sam'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Nikola Jokić'), (SELECT id FROM users WHERE username='jordan'), 10),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Jayson Tatum'), (SELECT id FROM users WHERE username='admin'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Jayson Tatum'), (SELECT id FROM users WHERE username='alex'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Jayson Tatum'), (SELECT id FROM users WHERE username='sam'), 4),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Jayson Tatum'), (SELECT id FROM users WHERE username='jordan'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Shai Gilgeous-Alexander'), (SELECT id FROM users WHERE username='admin'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Shai Gilgeous-Alexander'), (SELECT id FROM users WHERE username='alex'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Shai Gilgeous-Alexander'), (SELECT id FROM users WHERE username='sam'), 10),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Shai Gilgeous-Alexander'), (SELECT id FROM users WHERE username='jordan'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Giannis Antetokounmpo'), (SELECT id FROM users WHERE username='admin'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Giannis Antetokounmpo'), (SELECT id FROM users WHERE username='alex'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Giannis Antetokounmpo'), (SELECT id FROM users WHERE username='sam'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Giannis Antetokounmpo'), (SELECT id FROM users WHERE username='jordan'), 9);

-- Best AI Model 2026 ratings
INSERT INTO ratings (option_id, user_id, score) VALUES
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='GPT-5'), (SELECT id FROM users WHERE username='admin'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='GPT-5'), (SELECT id FROM users WHERE username='alex'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='GPT-5'), (SELECT id FROM users WHERE username='sam'), 5),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='GPT-5'), (SELECT id FROM users WHERE username='jordan'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Claude 4'), (SELECT id FROM users WHERE username='admin'), 10),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Claude 4'), (SELECT id FROM users WHERE username='alex'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Claude 4'), (SELECT id FROM users WHERE username='sam'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Claude 4'), (SELECT id FROM users WHERE username='jordan'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Gemini Ultra'), (SELECT id FROM users WHERE username='admin'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Gemini Ultra'), (SELECT id FROM users WHERE username='alex'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Gemini Ultra'), (SELECT id FROM users WHERE username='sam'), 4),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Gemini Ultra'), (SELECT id FROM users WHERE username='jordan'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Llama 4'), (SELECT id FROM users WHERE username='admin'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Llama 4'), (SELECT id FROM users WHERE username='alex'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Llama 4'), (SELECT id FROM users WHERE username='sam'), 10),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Llama 4'), (SELECT id FROM users WHERE username='jordan'), 5),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Grok 3'), (SELECT id FROM users WHERE username='admin'), 4),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Grok 3'), (SELECT id FROM users WHERE username='alex'), 5),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Grok 3'), (SELECT id FROM users WHERE username='sam'), 3),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Grok 3'), (SELECT id FROM users WHERE username='jordan'), 4);

-- Best Streaming Service ratings
INSERT INTO ratings (option_id, user_id, score) VALUES
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Netflix'), (SELECT id FROM users WHERE username='admin'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Netflix'), (SELECT id FROM users WHERE username='alex'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Netflix'), (SELECT id FROM users WHERE username='sam'), 5),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Netflix'), (SELECT id FROM users WHERE username='jordan'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='HBO Max'), (SELECT id FROM users WHERE username='admin'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='HBO Max'), (SELECT id FROM users WHERE username='alex'), 9),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='HBO Max'), (SELECT id FROM users WHERE username='sam'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='HBO Max'), (SELECT id FROM users WHERE username='jordan'), 10),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Apple TV+'), (SELECT id FROM users WHERE username='admin'), 8),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Apple TV+'), (SELECT id FROM users WHERE username='alex'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Apple TV+'), (SELECT id FROM users WHERE username='sam'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Apple TV+'), (SELECT id FROM users WHERE username='jordan'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Disney+'), (SELECT id FROM users WHERE username='admin'), 5),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Disney+'), (SELECT id FROM users WHERE username='alex'), 4),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Disney+'), (SELECT id FROM users WHERE username='sam'), 3),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Disney+'), (SELECT id FROM users WHERE username='jordan'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Hulu'), (SELECT id FROM users WHERE username='admin'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Hulu'), (SELECT id FROM users WHERE username='alex'), 5),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Hulu'), (SELECT id FROM users WHERE username='sam'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Hulu'), (SELECT id FROM users WHERE username='jordan'), 5),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Prime Video'), (SELECT id FROM users WHERE username='admin'), 6),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Prime Video'), (SELECT id FROM users WHERE username='alex'), 7),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Prime Video'), (SELECT id FROM users WHERE username='sam'), 4),
  ((SELECT o.id FROM options o JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Prime Video'), (SELECT id FROM users WHERE username='jordan'), 5);

-- =============================================================================
-- COMMENTS - spicy takes (2-3 per topic)
-- =============================================================================

-- iPhone comments
INSERT INTO comments (rating_id, user_id, content) VALUES
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 4' AND r.user_id=(SELECT id FROM users WHERE username='admin')),
   (SELECT id FROM users WHERE username='sam'),
   'Nostalgia bias is real. That phone had antennagate and a 3.5 inch screen'),
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone 16 Pro' AND r.user_id=(SELECT id FROM users WHERE username='sam')),
   (SELECT id FROM users WHERE username='alex'),
   'A 3?! The camera alone deserves a 7. You just hate new things.'),
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id WHERE t.slug='greatest-iphone-of-all-time' AND o.name='iPhone X' AND r.user_id=(SELECT id FROM users WHERE username='alex')),
   (SELECT id FROM users WHERE username='jordan'),
   'iPhone X was the biggest leap since the original. Face ID changed everything.');

-- Fast food comments
INSERT INTO comments (rating_id, user_id, content) VALUES
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='In-N-Out' AND r.user_id=(SELECT id FROM users WHERE username='sam')),
   (SELECT id FROM users WHERE username='admin'),
   'Tell me you have never had Animal Style without telling me'),
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-fast-food-chain' AND o.name='Chick-fil-A' AND r.user_id=(SELECT id FROM users WHERE username='alex')),
   (SELECT id FROM users WHERE username='jordan'),
   'Chick-fil-A sauce is literally addictive. The spicy deluxe is perfect.');

-- NBA comments
INSERT INTO comments (rating_id, user_id, content) VALUES
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Jayson Tatum' AND r.user_id=(SELECT id FROM users WHERE username='sam')),
   (SELECT id FROM users WHERE username='alex'),
   'A 4 is criminal. The man just won a championship.'),
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-nba-player-right-now' AND o.name='Nikola Jokić' AND r.user_id=(SELECT id FROM users WHERE username='admin')),
   (SELECT id FROM users WHERE username='sam'),
   'Big honey is inevitable. Best passing big man in NBA history.');

-- AI comments
INSERT INTO comments (rating_id, user_id, content) VALUES
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Claude 4' AND r.user_id=(SELECT id FROM users WHERE username='admin')),
   (SELECT id FROM users WHERE username='jordan'),
   'Based. Claude code output is on another level.'),
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-ai-model-2026' AND o.name='Llama 4' AND r.user_id=(SELECT id FROM users WHERE username='sam')),
   (SELECT id FROM users WHERE username='admin'),
   'Open source zealot detected. Llama is good but a 10 is crazy talk.');

-- Streaming comments
INSERT INTO comments (rating_id, user_id, content) VALUES
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='HBO Max' AND r.user_id=(SELECT id FROM users WHERE username='jordan')),
   (SELECT id FROM users WHERE username='admin'),
   'HBO never misses. Succession, The Last of Us, White Lotus... pure quality.'),
  ((SELECT r.id FROM ratings r JOIN options o ON r.option_id=o.id JOIN topics t ON o.topic_id=t.id WHERE t.slug='best-streaming-service' AND o.name='Disney+' AND r.user_id=(SELECT id FROM users WHERE username='sam')),
   (SELECT id FROM users WHERE username='alex'),
   'Disney+ is just a Marvel/Star Wars content dump at this point. No originals.');

-- =============================================================================
-- UPDATE DENORMALIZED FIELDS
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
  trending_score = sub.total * 1.5 + (EXTRACT(EPOCH FROM NOW()) / 86400),
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
