-- Seed categories, topics, and options for RateAnything prod
-- No votes/ratings — fresh content only

BEGIN;

-- =============================================================================
-- 1. CATEGORIES
-- =============================================================================
INSERT INTO categories (name, slug, description, sort_order) VALUES
  ('Tech', 'tech', 'Gadgets, software, and digital life', 1),
  ('Movies & TV', 'movies-tv', 'Film and television reviews', 2),
  ('Sports', 'sports', 'Athletes, teams, and games', 3),
  ('Food & Drink', 'food-drink', 'Restaurants, recipes, and beverages', 4),
  ('Travel', 'travel', 'Destinations, airlines, and hotels', 5),
  ('Music', 'music', 'Albums, artists, and concerts', 6),
  ('Gaming', 'gaming', 'Video games, consoles, and esports', 7)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 2. TOPICS
-- =============================================================================

-- Tech
INSERT INTO topics (title, slug, description, category_id, status, allow_new_options) VALUES
  ('Best Smartphone of 2026', 'best-smartphone-2026', 'Which flagship phone deserves the crown this year?', (SELECT id FROM categories WHERE slug = 'tech'), 'active', true),
  ('AI Tools You Actually Use', 'ai-tools-you-actually-use', 'Not the hype — which AI products are part of your daily workflow?', (SELECT id FROM categories WHERE slug = 'tech'), 'active', true),
  (' macOS vs Windows vs Linux', 'macos-vs-windows-vs-linux', 'The eternal debate. Which OS do you prefer in 2026?', (SELECT id FROM categories WHERE slug = 'tech'), 'active', false)
ON CONFLICT (slug) DO NOTHING;

-- Movies & TV
INSERT INTO topics (title, slug, description, category_id, status, allow_new_options) VALUES
  ('Best Movie of 2026 So Far', 'best-movie-2026-so-far', 'What''s the standout film of the year?', (SELECT id FROM categories WHERE slug = 'movies-tv'), 'active', true),
  ('Rate The Bear Season 4', 'rate-the-bear-season-4', 'Carmy is back. Did Season 4 deliver or lose the plot?', (SELECT id FROM categories WHERE slug = 'movies-tv'), 'active', true),
  ('Best Streaming Service', 'best-streaming-service', 'Netflix, Max, Hulu, Apple TV+ — who''s winning?', (SELECT id FROM categories WHERE slug = 'movies-tv'), 'active', false)
ON CONFLICT (slug) DO NOTHING;

-- Sports
INSERT INTO topics (title, slug, description, category_id, status, allow_new_options) VALUES
  ('NBA 2026 Finals Prediction', 'nba-2026-finals-prediction', 'Who takes the title this year?', (SELECT id FROM categories WHERE slug = 'sports'), 'active', true),
  ('Best Tennis Player Right Now', 'best-tennis-player-right-now', 'ATP rankings vs reality — who''s actually the best?', (SELECT id FROM categories WHERE slug = 'sports'), 'active', true),
  ('Rate Super Bowl LX Halftime Show', 'rate-super-bowl-lx-halftime-show', 'Did the halftime show live up to the hype?', (SELECT id FROM categories WHERE slug = 'sports'), 'active', false)
ON CONFLICT (slug) DO NOTHING;

-- Food & Drink
INSERT INTO topics (title, slug, description, category_id, status, allow_new_options) VALUES
  ('Best Pizza Style', 'best-pizza-style', 'New York, Chicago deep dish, Neapolitan, Detroit — fight me.', (SELECT id FROM categories WHERE slug = 'food-drink'), 'active', false),
  ('Coffee Chains Ranked', 'coffee-chains-ranked', 'Starbucks, Blue Bottle, Dunkin, local spots — where''s the best cup?', (SELECT id FROM categories WHERE slug = 'food-drink'), 'active', true),
  ('Best Burger in America', 'best-burger-in-america', 'Fast food, smash burgers, or gourmet — what''s the best?', (SELECT id FROM categories WHERE slug = 'food-drink'), 'active', true)
ON CONFLICT (slug) DO NOTHING;

-- Travel
INSERT INTO topics (title, slug, description, category_id, status, allow_new_options) VALUES
  ('Best Airline for Long Haul', 'best-airline-long-haul', 'Comfort, food, service — who''s actually pleasant at 35,000 feet?', (SELECT id FROM categories WHERE slug = 'travel'), 'active', true),
  ('Top City to Visit in 2026', 'top-city-to-visit-2026', 'Where should everyone be booking flights to this year?', (SELECT id FROM categories WHERE slug = 'travel'), 'active', true),
  ('Best Hotel Chain', 'best-hotel-chain', 'Luxury, boutique, or budget — who delivers the best stay?', (SELECT id FROM categories WHERE slug = 'travel'), 'active', false)
ON CONFLICT (slug) DO NOTHING;

-- Music
INSERT INTO topics (title, slug, description, category_id, status, allow_new_options) VALUES
  ('Best Album of 2026', 'best-album-of-2026', 'What release has dominated your playlist this year?', (SELECT id FROM categories WHERE slug = 'music'), 'active', true),
  ('Best Concert Experience', 'best-concert-experience', 'Stadium show or intimate venue — what''s the best live music you''ve seen?', (SELECT id FROM categories WHERE slug = 'music'), 'active', true),
  ('Rate Spotify vs Apple Music', 'rate-spotify-vs-apple-music', 'Which streaming app actually gets your music taste?', (SELECT id FROM categories WHERE slug = 'music'), 'active', false)
ON CONFLICT (slug) DO NOTHING;

-- Gaming
INSERT INTO topics (title, slug, description, category_id, status, allow_new_options) VALUES
  ('Best Game of 2026', 'best-game-of-2026', 'What game has you hooked right now?', (SELECT id FROM categories WHERE slug = 'gaming'), 'active', true),
  ('Best Gaming Console', 'best-gaming-console', 'PS5, Xbox Series X, Switch, PC — where do you play?', (SELECT id FROM categories WHERE slug = 'gaming'), 'active', false),
  ('Rate GTA VI', 'rate-gta-vi', 'After years of waiting, does Rockstar deliver?', (SELECT id FROM categories WHERE slug = 'gaming'), 'active', false)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 3. OPTIONS
-- =============================================================================

-- Best Smartphone of 2026
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-smartphone-2026'), 'iPhone 17 Pro', 'Apple''s latest flagship', 1),
  ((SELECT id FROM topics WHERE slug = 'best-smartphone-2026'), 'Samsung Galaxy S26 Ultra', 'The Android powerhouse', 2),
  ((SELECT id FROM topics WHERE slug = 'best-smartphone-2026'), 'Google Pixel 10 Pro', 'Best camera and pure Android', 3),
  ((SELECT id FROM topics WHERE slug = 'best-smartphone-2026'), 'OnePlus 15', 'Flagship killer returns', 4)
ON CONFLICT (topic_id, name) DO NOTHING;

-- AI Tools You Actually Use
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'ai-tools-you-actually-use'), 'ChatGPT', 'OpenAI''s conversational AI', 1),
  ((SELECT id FROM topics WHERE slug = 'ai-tools-you-actually-use'), 'Claude', 'Anthropic''s assistant', 2),
  ((SELECT id FROM topics WHERE slug = 'ai-tools-you-actually-use'), 'GitHub Copilot', 'AI pair programmer', 3),
  ((SELECT id FROM topics WHERE slug = 'ai-tools-you-actually-use'), 'Midjourney', 'AI image generation', 4),
  ((SELECT id FROM topics WHERE slug = 'ai-tools-you-actually-use'), 'Perplexity', 'AI search engine', 5)
ON CONFLICT (topic_id, name) DO NOTHING;

-- macOS vs Windows vs Linux
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'macos-vs-windows-vs-linux'), 'macOS', 'Apple''s polished ecosystem', 1),
  ((SELECT id FROM topics WHERE slug = 'macos-vs-windows-vs-linux'), 'Windows', 'The versatile standard', 2),
  ((SELECT id FROM topics WHERE slug = 'macos-vs-windows-vs-linux'), 'Linux', 'Open source and customizable', 3)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Best Movie of 2026 So Far
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-movie-2026-so-far'), 'Superman', 'James Gunn''s DC reboot', 1),
  ((SELECT id FROM topics WHERE slug = 'best-movie-2026-so-far'), 'The Odyssey', 'Christopher Nolan''s epic', 2),
  ((SELECT id FROM topics WHERE slug = 'best-movie-2026-so-far'), 'Mission: Impossible 8', 'Tom Cruise''s latest stunt fest', 3),
  ((SELECT id FROM topics WHERE slug = 'best-movie-2026-so-far'), 'Jurassic World: Rebirth', 'Dinosaurs return', 4)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Rate The Bear Season 4
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'rate-the-bear-season-4'), '5 - Masterpiece', 'Perfection from start to finish', 1),
  ((SELECT id FROM topics WHERE slug = 'rate-the-bear-season-4'), '4 - Great', 'Excellent with minor flaws', 2),
  ((SELECT id FROM topics WHERE slug = 'rate-the-bear-season-4'), '3 - Good', 'Solid but not groundbreaking', 3),
  ((SELECT id FROM topics WHERE slug = 'rate-the-bear-season-4'), '2 - Okay', 'Had some moments', 4),
  ((SELECT id FROM topics WHERE slug = 'rate-the-bear-season-4'), '1 - Disappointing', 'Did not live up to the hype', 5)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Best Streaming Service
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-streaming-service'), 'Netflix', 'The original giant', 1),
  ((SELECT id FROM topics WHERE slug = 'best-streaming-service'), 'Max', 'HBO + Discovery', 2),
  ((SELECT id FROM topics WHERE slug = 'best-streaming-service'), 'Hulu', 'Great TV catalog', 3),
  ((SELECT id FROM topics WHERE slug = 'best-streaming-service'), 'Apple TV+', 'Quality over quantity', 4),
  ((SELECT id FROM topics WHERE slug = 'best-streaming-service'), 'Disney+', 'Marvel, Star Wars, Pixar', 5)
ON CONFLICT (topic_id, name) DO NOTHING;

-- NBA 2026 Finals Prediction
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'nba-2026-finals-prediction'), 'Boston Celtics', 'Defending champs', 1),
  ((SELECT id FROM topics WHERE slug = 'nba-2026-finals-prediction'), 'Oklahoma City Thunder', 'Young and hungry', 2),
  ((SELECT id FROM topics WHERE slug = 'nba-2026-finals-prediction'), 'Denver Nuggets', 'Jokic and the crew', 3),
  ((SELECT id FROM topics WHERE slug = 'nba-2026-finals-prediction'), 'Dallas Mavericks', 'Luka-led powerhouse', 4)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Best Tennis Player Right Now
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-tennis-player-right-now'), 'Carlos Alcaraz', 'The Spanish phenom', 1),
  ((SELECT id FROM topics WHERE slug = 'best-tennis-player-right-now'), 'Jannik Sinner', 'Italian powerhouse', 2),
  ((SELECT id FROM topics WHERE slug = 'best-tennis-player-right-now'), 'Novak Djokovic', 'The veteran GOAT', 3),
  ((SELECT id FROM topics WHERE slug = 'best-tennis-player-right-now'), 'Alexander Zverev', 'German contender', 4)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Rate Super Bowl LX Halftime Show
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'rate-super-bowl-lx-halftime-show'), '5 - Legendary', 'All-time great performance', 1),
  ((SELECT id FROM topics WHERE slug = 'rate-super-bowl-lx-halftime-show'), '4 - Great', 'Really entertaining', 2),
  ((SELECT id FROM topics WHERE slug = 'rate-super-bowl-lx-halftime-show'), '3 - Good', 'Solid but not memorable', 3),
  ((SELECT id FROM topics WHERE slug = 'rate-super-bowl-lx-halftime-show'), '2 - Okay', 'Had some good moments', 4),
  ((SELECT id FROM topics WHERE slug = 'rate-super-bowl-lx-halftime-show'), '1 - Skip', 'Waste of time', 5)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Best Pizza Style
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-pizza-style'), 'New York', 'Thin, foldable, classic', 1),
  ((SELECT id FROM topics WHERE slug = 'best-pizza-style'), 'Chicago Deep Dish', 'Thick, saucy, hearty', 2),
  ((SELECT id FROM topics WHERE slug = 'best-pizza-style'), 'Neapolitan', 'Authentic Italian, wood-fired', 3),
  ((SELECT id FROM topics WHERE slug = 'best-pizza-style'), 'Detroit', 'Crispy edges, fluffy center', 4)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Coffee Chains Ranked
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'coffee-chains-ranked'), 'Starbucks', 'The ubiquitous choice', 1),
  ((SELECT id FROM topics WHERE slug = 'coffee-chains-ranked'), 'Blue Bottle', 'Third wave, artisanal', 2),
  ((SELECT id FROM topics WHERE slug = 'coffee-chains-ranked'), 'Dunkin', 'Fast, cheap, reliable', 3),
  ((SELECT id FROM topics WHERE slug = 'coffee-chains-ranked'), 'La Colombe', 'Premium draft lattes', 4),
  ((SELECT id FROM topics WHERE slug = 'coffee-chains-ranked'), 'Local Coffee Shop', 'Support your neighborhood', 5)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Best Burger in America
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-burger-in-america'), 'Shake Shack', 'Premium fast casual', 1),
  ((SELECT id FROM topics WHERE slug = 'best-burger-in-america'), 'In-N-Out', 'West Coast classic', 2),
  ((SELECT id FROM topics WHERE slug = 'best-burger-in-america'), 'Five Guys', 'Customizable and greasy', 3),
  ((SELECT id FROM topics WHERE slug = 'best-burger-in-america'), 'Smashburger', 'Thin, crispy, smashed', 4),
  ((SELECT id FROM topics WHERE slug = 'best-burger-in-america'), 'Local Gourmet', 'The hidden gem', 5)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Best Airline for Long Haul
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-airline-long-haul'), 'Singapore Airlines', 'Consistently rated #1', 1),
  ((SELECT id FROM topics WHERE slug = 'best-airline-long-haul'), 'Qatar Airways', 'Luxury in the sky', 2),
  ((SELECT id FROM topics WHERE slug = 'best-airline-long-haul'), 'Emirates', 'A380 experience', 3),
  ((SELECT id FROM topics WHERE slug = 'best-airline-long-haul'), 'ANA', 'Japanese hospitality', 4),
  ((SELECT id FROM topics WHERE slug = 'best-airline-long-haul'), 'Delta', 'Best US carrier', 5)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Top City to Visit in 2026
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'top-city-to-visit-2026'), 'Tokyo', 'Neon lights and ancient temples', 1),
  ((SELECT id FROM topics WHERE slug = 'top-city-to-visit-2026'), 'Paris', 'Always a classic', 2),
  ((SELECT id FROM topics WHERE slug = 'top-city-to-visit-2026'), 'Lisbon', 'Affordable and beautiful', 3),
  ((SELECT id FROM topics WHERE slug = 'top-city-to-visit-2026'), 'Mexico City', 'Food, culture, energy', 4),
  ((SELECT id FROM topics WHERE slug = 'top-city-to-visit-2026'), 'Seoul', 'K-culture capital', 5)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Best Hotel Chain
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-hotel-chain'), 'Four Seasons', 'Unmatched luxury', 1),
  ((SELECT id FROM topics WHERE slug = 'best-hotel-chain'), 'Marriott', 'Reliable everywhere', 2),
  ((SELECT id FROM topics WHERE slug = 'best-hotel-chain'), 'Hilton', 'Comfort and consistency', 3),
  ((SELECT id FROM topics WHERE slug = 'best-hotel-chain'), 'Hyatt', 'Modern and well-designed', 4),
  ((SELECT id FROM topics WHERE slug = 'best-hotel-chain'), 'Airbnb', 'Not a chain, but popular', 5)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Best Album of 2026
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-album-of-2026'), 'Kendrick Lamar', 'His latest surprise drop', 1),
  ((SELECT id FROM topics WHERE slug = 'best-album-of-2026'), 'Taylor Swift', 'The 2026 release', 2),
  ((SELECT id FROM topics WHERE slug = 'best-album-of-2026'), 'Drake', 'Another year, another album', 3),
  ((SELECT id FROM topics WHERE slug = 'best-album-of-2026'), 'Billie Eilish', 'Her evolving sound', 4),
  ((SELECT id FROM topics WHERE slug = 'best-album-of-2026'), 'The Weeknd', 'Dark and cinematic', 5)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Best Concert Experience
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-concert-experience'), 'Stadium Show', 'Massive production, 50K+ fans', 1),
  ((SELECT id FROM topics WHERE slug = 'best-concert-experience'), 'Intimate Venue', 'Small club, up close', 2),
  ((SELECT id FROM topics WHERE slug = 'best-concert-experience'), 'Festival', 'Multi-day, camping, energy', 3),
  ((SELECT id FROM topics WHERE slug = 'best-concert-experience'), 'Acoustic Set', 'Stripped down, raw', 4)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Rate Spotify vs Apple Music
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'rate-spotify-vs-apple-music'), 'Spotify', 'Best algorithms and playlists', 1),
  ((SELECT id FROM topics WHERE slug = 'rate-spotify-vs-apple-music'), 'Apple Music', 'Best audio quality and integration', 2),
  ((SELECT id FROM topics WHERE slug = 'rate-spotify-vs-apple-music'), 'YouTube Music', 'Videos + music in one', 3),
  ((SELECT id FROM topics WHERE slug = 'rate-spotify-vs-apple-music'), 'Tidal', 'Audiophile choice', 4)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Best Game of 2026
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-game-of-2026'), 'GTA VI', 'The most anticipated game ever', 1),
  ((SELECT id FROM topics WHERE slug = 'best-game-of-2026'), 'Elden Ring: Nightreign', 'FromSoftware returns', 2),
  ((SELECT id FROM topics WHERE slug = 'best-game-of-2026'), 'Death Stranding 2', 'Kojima''s next vision', 3),
  ((SELECT id FROM topics WHERE slug = 'best-game-of-2026'), 'Borderlands 4', 'Loot and shoot', 4)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Best Gaming Console
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'best-gaming-console'), 'PlayStation 5', 'Sony''s exclusive powerhouse', 1),
  ((SELECT id FROM topics WHERE slug = 'best-gaming-console'), 'Xbox Series X', 'Power and Game Pass', 2),
  ((SELECT id FROM topics WHERE slug = 'best-gaming-console'), 'Nintendo Switch 2', 'Portability + exclusives', 3),
  ((SELECT id FROM topics WHERE slug = 'best-gaming-console'), 'Gaming PC', 'Ultimate performance', 4)
ON CONFLICT (topic_id, name) DO NOTHING;

-- Rate GTA VI
INSERT INTO options (topic_id, name, description, sort_order) VALUES
  ((SELECT id FROM topics WHERE slug = 'rate-gta-vi'), '5 - Masterpiece', 'Exceeds all expectations', 1),
  ((SELECT id FROM topics WHERE slug = 'rate-gta-vi'), '4 - Great', 'Excellent, minor issues', 2),
  ((SELECT id FROM topics WHERE slug = 'rate-gta-vi'), '3 - Good', 'Solid Rockstar experience', 3),
  ((SELECT id FROM topics WHERE slug = 'rate-gta-vi'), '2 - Okay', 'Disappointing in parts', 4),
  ((SELECT id FROM topics WHERE slug = 'rate-gta-vi'), '1 - Bad', 'Does not live up to the hype', 5)
ON CONFLICT (topic_id, name) DO NOTHING;

COMMIT;
