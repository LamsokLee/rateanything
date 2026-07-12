-- Seed hot topics for RateAnything (2026 trending debates)
-- Uses existing users: admin, alex, sam, jordan

DO $$
DECLARE
  v_admin_id uuid := '7b2a5c0c-db8c-4f01-ba52-11c39d1c4a78';
  v_alex_id uuid := '47b4278a-be75-48d6-9a72-0d54d7934a6e';
  v_sam_id uuid := '9e48c179-35de-44fa-bf76-eaf5129eba0f';
  v_jordan_id uuid := '136e95e9-5b5d-4e8a-8fd9-add954862a42';
  v_topic_id uuid;
  v_opt_id uuid;
BEGIN

-- ============ TECH ============

-- 1. Best Programming Language 2026
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Best Programming Language 2026', 'best-programming-language-2026', 'Which language reigns supreme for general-purpose development in 2026?', 3, v_admin_id, 'active', NOW() - interval '10 days', NOW() - interval '1 hour')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'Python', 0),
(uuid_generate_v4(), v_topic_id, 'TypeScript', 1),
(uuid_generate_v4(), v_topic_id, 'Rust', 2),
(uuid_generate_v4(), v_topic_id, 'Go', 3),
(uuid_generate_v4(), v_topic_id, 'Java', 4),
(uuid_generate_v4(), v_topic_id, 'C#', 5),
(uuid_generate_v4(), v_topic_id, 'Kotlin', 6);

-- Ratings for each option (spread over 14 days)
INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'Python' THEN 9 WHEN 'TypeScript' THEN 8 WHEN 'Rust' THEN 9 WHEN 'Go' THEN 7 WHEN 'Java' THEN 6 WHEN 'C#' THEN 6 WHEN 'Kotlin' THEN 7 END,
  CASE o.name WHEN 'Python' THEN 'AI/ML ecosystem is unbeatable' WHEN 'Rust' THEN 'Memory safety without GC is the future' ELSE NULL END,
  NOW() - interval '13 days' + (random() * interval '12 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'Python' THEN 7 WHEN 'TypeScript' THEN 9 WHEN 'Rust' THEN 8 WHEN 'Go' THEN 8 WHEN 'Java' THEN 5 WHEN 'C#' THEN 7 WHEN 'Kotlin' THEN 8 END,
  CASE o.name WHEN 'TypeScript' THEN 'Full-stack type safety is a game changer' ELSE NULL END,
  NOW() - interval '10 days' + (random() * interval '9 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'Python' THEN 8 WHEN 'TypeScript' THEN 7 WHEN 'Rust' THEN 10 WHEN 'Go' THEN 9 WHEN 'Java' THEN 7 WHEN 'C#' THEN 6 WHEN 'Kotlin' THEN 6 END,
  CASE o.name WHEN 'Rust' THEN 'Blazingly fast. No cap.' WHEN 'Go' THEN 'Simplicity wins for backend services' ELSE NULL END,
  NOW() - interval '7 days' + (random() * interval '6 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'Python' THEN 8 WHEN 'TypeScript' THEN 9 WHEN 'Rust' THEN 7 WHEN 'Go' THEN 7 WHEN 'Java' THEN 8 WHEN 'C#' THEN 8 WHEN 'Kotlin' THEN 9 END,
  NULL, NOW() - interval '3 days' + (random() * interval '2 days')
FROM options o WHERE o.topic_id = v_topic_id;

-- 2. Best AI Coding Assistant
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Best AI Coding Assistant', 'best-ai-coding-assistant', 'Which AI pair programmer actually ships code in 2026?', 3, v_alex_id, 'active', NOW() - interval '8 days', NOW() - interval '2 hours')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'GitHub Copilot', 0),
(uuid_generate_v4(), v_topic_id, 'Cursor', 1),
(uuid_generate_v4(), v_topic_id, 'Claude Code', 2),
(uuid_generate_v4(), v_topic_id, 'Windsurf', 3),
(uuid_generate_v4(), v_topic_id, 'Devin', 4);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'GitHub Copilot' THEN 7 WHEN 'Cursor' THEN 9 WHEN 'Claude Code' THEN 10 WHEN 'Windsurf' THEN 7 WHEN 'Devin' THEN 6 END,
  CASE o.name WHEN 'Claude Code' THEN 'The agentic workflow is insane — it just builds entire features' WHEN 'Cursor' THEN 'Tab-complete on steroids, great for flow state' ELSE NULL END,
  NOW() - interval '7 days' + (random() * interval '6 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'GitHub Copilot' THEN 6 WHEN 'Cursor' THEN 10 WHEN 'Claude Code' THEN 9 WHEN 'Windsurf' THEN 8 WHEN 'Devin' THEN 5 END,
  CASE o.name WHEN 'Cursor' THEN 'Multi-file edits are chef kiss' ELSE NULL END,
  NOW() - interval '5 days' + (random() * interval '4 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'GitHub Copilot' THEN 8 WHEN 'Cursor' THEN 8 WHEN 'Claude Code' THEN 9 WHEN 'Windsurf' THEN 7 WHEN 'Devin' THEN 4 END,
  CASE o.name WHEN 'Devin' THEN 'More hype than substance honestly' ELSE NULL END,
  NOW() - interval '3 days' + (random() * interval '2 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'GitHub Copilot' THEN 7 WHEN 'Cursor' THEN 9 WHEN 'Claude Code' THEN 8 WHEN 'Windsurf' THEN 8 WHEN 'Devin' THEN 7 END,
  NULL, NOW() - interval '1 day' + (random() * interval '12 hours')
FROM options o WHERE o.topic_id = v_topic_id;

-- 3. Best Laptop 2026
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Best Laptop 2026', 'best-laptop-2026', 'Which laptop is the ultimate developer machine?', 3, v_sam_id, 'active', NOW() - interval '12 days', NOW() - interval '5 hours')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'MacBook Pro M5', 0),
(uuid_generate_v4(), v_topic_id, 'ThinkPad X1 Carbon', 1),
(uuid_generate_v4(), v_topic_id, 'Framework 16', 2),
(uuid_generate_v4(), v_topic_id, 'Dell XPS 15', 3),
(uuid_generate_v4(), v_topic_id, 'Surface Laptop 7', 4);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'MacBook Pro M5' THEN 10 WHEN 'ThinkPad X1 Carbon' THEN 8 WHEN 'Framework 16' THEN 9 WHEN 'Dell XPS 15' THEN 7 WHEN 'Surface Laptop 7' THEN 6 END,
  CASE o.name WHEN 'MacBook Pro M5' THEN 'Battery life is absurd — 24hrs coding' WHEN 'Framework 16' THEN 'Right to repair ftw' ELSE NULL END,
  NOW() - interval '11 days' + (random() * interval '10 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'MacBook Pro M5' THEN 9 WHEN 'ThinkPad X1 Carbon' THEN 9 WHEN 'Framework 16' THEN 7 WHEN 'Dell XPS 15' THEN 6 WHEN 'Surface Laptop 7' THEN 7 END,
  CASE o.name WHEN 'ThinkPad X1 Carbon' THEN 'That keyboard is still king for typing all day' ELSE NULL END,
  NOW() - interval '8 days' + (random() * interval '7 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'MacBook Pro M5' THEN 8 WHEN 'ThinkPad X1 Carbon' THEN 7 WHEN 'Framework 16' THEN 10 WHEN 'Dell XPS 15' THEN 7 WHEN 'Surface Laptop 7' THEN 5 END,
  NULL, NOW() - interval '5 days' + (random() * interval '4 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'MacBook Pro M5' THEN 9 WHEN 'ThinkPad X1 Carbon' THEN 7 WHEN 'Framework 16' THEN 8 WHEN 'Dell XPS 15' THEN 8 WHEN 'Surface Laptop 7' THEN 7 END,
  NULL, NOW() - interval '2 days' + (random() * interval '1 day')
FROM options o WHERE o.topic_id = v_topic_id;

-- ============ SPORTS ============

-- 4. Greatest NBA Team of All Time
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Greatest NBA Team of All Time', 'greatest-nba-team-of-all-time', 'Which squad would win a tournament of the best teams ever assembled?', 1, v_jordan_id, 'active', NOW() - interval '13 days', NOW() - interval '3 hours')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, '1996 Chicago Bulls', 0),
(uuid_generate_v4(), v_topic_id, '2017 Golden State Warriors', 1),
(uuid_generate_v4(), v_topic_id, '2001 Los Angeles Lakers', 2),
(uuid_generate_v4(), v_topic_id, '1986 Boston Celtics', 3),
(uuid_generate_v4(), v_topic_id, '2013 Miami Heat', 4);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN '1996 Chicago Bulls' THEN 10 WHEN '2017 Golden State Warriors' THEN 9 WHEN '2001 Los Angeles Lakers' THEN 8 WHEN '1986 Boston Celtics' THEN 8 WHEN '2013 Miami Heat' THEN 7 END,
  CASE o.name WHEN '1996 Chicago Bulls' THEN '72-10. MJ. Case closed.' ELSE NULL END,
  NOW() - interval '12 days' + (random() * interval '11 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN '1996 Chicago Bulls' THEN 9 WHEN '2017 Golden State Warriors' THEN 10 WHEN '2001 Los Angeles Lakers' THEN 7 WHEN '1986 Boston Celtics' THEN 7 WHEN '2013 Miami Heat' THEN 8 END,
  CASE o.name WHEN '2017 Golden State Warriors' THEN '4 all-stars and the most beautiful basketball ever played' ELSE NULL END,
  NOW() - interval '9 days' + (random() * interval '8 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN '1996 Chicago Bulls' THEN 10 WHEN '2017 Golden State Warriors' THEN 8 WHEN '2001 Los Angeles Lakers' THEN 9 WHEN '1986 Boston Celtics' THEN 9 WHEN '2013 Miami Heat' THEN 7 END,
  CASE o.name WHEN '2001 Los Angeles Lakers' THEN 'Prime Shaq was literally unstoppable' ELSE NULL END,
  NOW() - interval '6 days' + (random() * interval '5 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN '1996 Chicago Bulls' THEN 10 WHEN '2017 Golden State Warriors' THEN 9 WHEN '2001 Los Angeles Lakers' THEN 8 WHEN '1986 Boston Celtics' THEN 8 WHEN '2013 Miami Heat' THEN 9 END,
  NULL, NOW() - interval '2 days' + (random() * interval '1 day')
FROM options o WHERE o.topic_id = v_topic_id;

-- 5. Best Soccer Player 2026
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Best Soccer Player 2026', 'best-soccer-player-2026', 'Who is the best footballer on the planet right now?', 1, v_alex_id, 'active', NOW() - interval '6 days', NOW() - interval '4 hours')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'Kylian Mbappé', 0),
(uuid_generate_v4(), v_topic_id, 'Erling Haaland', 1),
(uuid_generate_v4(), v_topic_id, 'Vinícius Jr', 2),
(uuid_generate_v4(), v_topic_id, 'Jude Bellingham', 3),
(uuid_generate_v4(), v_topic_id, 'Mohamed Salah', 4);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'Kylian Mbappé' THEN 9 WHEN 'Erling Haaland' THEN 10 WHEN 'Vinícius Jr' THEN 8 WHEN 'Jude Bellingham' THEN 8 WHEN 'Mohamed Salah' THEN 7 END,
  CASE o.name WHEN 'Erling Haaland' THEN 'Machine. 50+ goals every season now.' ELSE NULL END,
  NOW() - interval '5 days' + (random() * interval '4 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'Kylian Mbappé' THEN 10 WHEN 'Erling Haaland' THEN 9 WHEN 'Vinícius Jr' THEN 9 WHEN 'Jude Bellingham' THEN 8 WHEN 'Mohamed Salah' THEN 8 END,
  CASE o.name WHEN 'Kylian Mbappé' THEN 'Speed + skill + clutch factor = GOAT trajectory' ELSE NULL END,
  NOW() - interval '4 days' + (random() * interval '3 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'Kylian Mbappé' THEN 8 WHEN 'Erling Haaland' THEN 9 WHEN 'Vinícius Jr' THEN 10 WHEN 'Jude Bellingham' THEN 9 WHEN 'Mohamed Salah' THEN 7 END,
  CASE o.name WHEN 'Vinícius Jr' THEN 'Most entertaining player to watch. Pure magic.' ELSE NULL END,
  NOW() - interval '2 days' + (random() * interval '1 day')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'Kylian Mbappé' THEN 9 WHEN 'Erling Haaland' THEN 8 WHEN 'Vinícius Jr' THEN 9 WHEN 'Jude Bellingham' THEN 10 WHEN 'Mohamed Salah' THEN 8 END,
  NULL, NOW() - interval '1 day' + (random() * interval '12 hours')
FROM options o WHERE o.topic_id = v_topic_id;

-- ============ MOVIES & TV ============

-- 6. Best TV Show of All Time
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Best TV Show of All Time', 'best-tv-show-of-all-time', 'The ultimate prestige TV debate. Which show is the GOAT?', 2, v_admin_id, 'active', NOW() - interval '14 days', NOW() - interval '1 hour')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'Breaking Bad', 0),
(uuid_generate_v4(), v_topic_id, 'The Wire', 1),
(uuid_generate_v4(), v_topic_id, 'The Sopranos', 2),
(uuid_generate_v4(), v_topic_id, 'Game of Thrones', 3),
(uuid_generate_v4(), v_topic_id, 'The Office', 4),
(uuid_generate_v4(), v_topic_id, 'Succession', 5);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'Breaking Bad' THEN 10 WHEN 'The Wire' THEN 10 WHEN 'The Sopranos' THEN 9 WHEN 'Game of Thrones' THEN 6 WHEN 'The Office' THEN 8 WHEN 'Succession' THEN 9 END,
  CASE o.name WHEN 'Breaking Bad' THEN 'Perfect from pilot to finale. Not a single wasted scene.' WHEN 'Game of Thrones' THEN 'Seasons 1-4 were a 10. That ending though...' ELSE NULL END,
  NOW() - interval '13 days' + (random() * interval '12 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'Breaking Bad' THEN 9 WHEN 'The Wire' THEN 9 WHEN 'The Sopranos' THEN 10 WHEN 'Game of Thrones' THEN 7 WHEN 'The Office' THEN 9 WHEN 'Succession' THEN 10 END,
  CASE o.name WHEN 'Succession' THEN 'Best dialogue writing since Sorkin. Every scene is a masterclass.' ELSE NULL END,
  NOW() - interval '10 days' + (random() * interval '9 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'Breaking Bad' THEN 10 WHEN 'The Wire' THEN 10 WHEN 'The Sopranos' THEN 9 WHEN 'Game of Thrones' THEN 5 WHEN 'The Office' THEN 7 WHEN 'Succession' THEN 8 END,
  CASE o.name WHEN 'The Wire' THEN 'This is not a TV show. This is a novel for television.' ELSE NULL END,
  NOW() - interval '7 days' + (random() * interval '6 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'Breaking Bad' THEN 9 WHEN 'The Wire' THEN 8 WHEN 'The Sopranos' THEN 9 WHEN 'Game of Thrones' THEN 8 WHEN 'The Office' THEN 10 WHEN 'Succession' THEN 9 END,
  CASE o.name WHEN 'The Office' THEN 'Peak comfort TV. Rewatched it 6 times no regrets.' ELSE NULL END,
  NOW() - interval '3 days' + (random() * interval '2 days')
FROM options o WHERE o.topic_id = v_topic_id;

-- 7. Best Marvel Movie
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Best Marvel Movie', 'best-marvel-movie', 'Which MCU film is the peak of superhero cinema?', 2, v_jordan_id, 'active', NOW() - interval '9 days', NOW() - interval '6 hours')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'Avengers: Endgame', 0),
(uuid_generate_v4(), v_topic_id, 'Avengers: Infinity War', 1),
(uuid_generate_v4(), v_topic_id, 'Iron Man', 2),
(uuid_generate_v4(), v_topic_id, 'Spider-Man: Into the Spider-Verse', 3),
(uuid_generate_v4(), v_topic_id, 'Guardians of the Galaxy', 4),
(uuid_generate_v4(), v_topic_id, 'Spider-Man: No Way Home', 5);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'Avengers: Endgame' THEN 9 WHEN 'Avengers: Infinity War' THEN 10 WHEN 'Iron Man' THEN 8 WHEN 'Spider-Man: Into the Spider-Verse' THEN 10 WHEN 'Guardians of the Galaxy' THEN 8 WHEN 'Spider-Man: No Way Home' THEN 9 END,
  CASE o.name WHEN 'Spider-Man: Into the Spider-Verse' THEN 'Best animated film of the decade. Art style alone is a 10.' ELSE NULL END,
  NOW() - interval '8 days' + (random() * interval '7 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'Avengers: Endgame' THEN 10 WHEN 'Avengers: Infinity War' THEN 9 WHEN 'Iron Man' THEN 9 WHEN 'Spider-Man: Into the Spider-Verse' THEN 9 WHEN 'Guardians of the Galaxy' THEN 9 WHEN 'Spider-Man: No Way Home' THEN 10 END,
  CASE o.name WHEN 'Spider-Man: No Way Home' THEN 'Three Spider-Men. Theater went absolutely insane.' ELSE NULL END,
  NOW() - interval '6 days' + (random() * interval '5 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'Avengers: Endgame' THEN 8 WHEN 'Avengers: Infinity War' THEN 10 WHEN 'Iron Man' THEN 9 WHEN 'Spider-Man: Into the Spider-Verse' THEN 10 WHEN 'Guardians of the Galaxy' THEN 7 WHEN 'Spider-Man: No Way Home' THEN 8 END,
  CASE o.name WHEN 'Avengers: Infinity War' THEN 'Thanos was right. Best villain arc in MCU.' ELSE NULL END,
  NOW() - interval '4 days' + (random() * interval '3 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'Avengers: Endgame' THEN 10 WHEN 'Avengers: Infinity War' THEN 9 WHEN 'Iron Man' THEN 10 WHEN 'Spider-Man: Into the Spider-Verse' THEN 8 WHEN 'Guardians of the Galaxy' THEN 10 WHEN 'Spider-Man: No Way Home' THEN 9 END,
  CASE o.name WHEN 'Iron Man' THEN 'Started it all. RDJ IS Tony Stark.' ELSE NULL END,
  NOW() - interval '2 days' + (random() * interval '1 day')
FROM options o WHERE o.topic_id = v_topic_id;

-- 8. Best Director Working Today
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Best Director Working Today', 'best-director-working-today', 'Who is making the best films in 2026?', 2, v_sam_id, 'active', NOW() - interval '7 days', NOW() - interval '8 hours')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'Christopher Nolan', 0),
(uuid_generate_v4(), v_topic_id, 'Denis Villeneuve', 1),
(uuid_generate_v4(), v_topic_id, 'Martin Scorsese', 2),
(uuid_generate_v4(), v_topic_id, 'Greta Gerwig', 3),
(uuid_generate_v4(), v_topic_id, 'Jordan Peele', 4);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'Christopher Nolan' THEN 9 WHEN 'Denis Villeneuve' THEN 10 WHEN 'Martin Scorsese' THEN 9 WHEN 'Greta Gerwig' THEN 8 WHEN 'Jordan Peele' THEN 8 END,
  CASE o.name WHEN 'Denis Villeneuve' THEN 'Dune Part Two was a religious experience in IMAX' ELSE NULL END,
  NOW() - interval '6 days' + (random() * interval '5 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'Christopher Nolan' THEN 10 WHEN 'Denis Villeneuve' THEN 9 WHEN 'Martin Scorsese' THEN 8 WHEN 'Greta Gerwig' THEN 9 WHEN 'Jordan Peele' THEN 7 END,
  CASE o.name WHEN 'Christopher Nolan' THEN 'Oppenheimer proved he can do intimate character drama too' ELSE NULL END,
  NOW() - interval '4 days' + (random() * interval '3 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'Christopher Nolan' THEN 8 WHEN 'Denis Villeneuve' THEN 10 WHEN 'Martin Scorsese' THEN 10 WHEN 'Greta Gerwig' THEN 8 WHEN 'Jordan Peele' THEN 9 END,
  CASE o.name WHEN 'Jordan Peele' THEN 'Reinvented horror for a generation. Get Out was a cultural reset.' ELSE NULL END,
  NOW() - interval '2 days' + (random() * interval '1 day')
FROM options o WHERE o.topic_id = v_topic_id;

-- ============ FOOD ============

-- 9. Best Coffee Chain
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Best Coffee Chain', 'best-coffee-chain', 'Where do you get your daily caffeine fix?', 7, v_jordan_id, 'active', NOW() - interval '11 days', NOW() - interval '2 hours')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'Starbucks', 0),
(uuid_generate_v4(), v_topic_id, 'Dunkin', 1),
(uuid_generate_v4(), v_topic_id, 'Blue Bottle', 2),
(uuid_generate_v4(), v_topic_id, 'Philz Coffee', 3),
(uuid_generate_v4(), v_topic_id, 'Peets Coffee', 4),
(uuid_generate_v4(), v_topic_id, 'Local Roaster', 5);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'Starbucks' THEN 5 WHEN 'Dunkin' THEN 6 WHEN 'Blue Bottle' THEN 9 WHEN 'Philz Coffee' THEN 8 WHEN 'Peets Coffee' THEN 7 WHEN 'Local Roaster' THEN 10 END,
  CASE o.name WHEN 'Local Roaster' THEN 'Support your local shop. Always better beans.' WHEN 'Starbucks' THEN 'Burned milk and sugar water. Fight me.' ELSE NULL END,
  NOW() - interval '10 days' + (random() * interval '9 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'Starbucks' THEN 7 WHEN 'Dunkin' THEN 8 WHEN 'Blue Bottle' THEN 8 WHEN 'Philz Coffee' THEN 9 WHEN 'Peets Coffee' THEN 6 WHEN 'Local Roaster' THEN 9 END,
  CASE o.name WHEN 'Dunkin' THEN 'East coast energy. Fast, cheap, consistent.' ELSE NULL END,
  NOW() - interval '7 days' + (random() * interval '6 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'Starbucks' THEN 6 WHEN 'Dunkin' THEN 5 WHEN 'Blue Bottle' THEN 10 WHEN 'Philz Coffee' THEN 9 WHEN 'Peets Coffee' THEN 7 WHEN 'Local Roaster' THEN 8 END,
  CASE o.name WHEN 'Blue Bottle' THEN 'Single origin pour-over is worth the wait and the price' ELSE NULL END,
  NOW() - interval '4 days' + (random() * interval '3 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'Starbucks' THEN 7 WHEN 'Dunkin' THEN 7 WHEN 'Blue Bottle' THEN 7 WHEN 'Philz Coffee' THEN 10 WHEN 'Peets Coffee' THEN 8 WHEN 'Local Roaster' THEN 9 END,
  NULL, NOW() - interval '1 day' + (random() * interval '12 hours')
FROM options o WHERE o.topic_id = v_topic_id;

-- 10. Best Pizza Style
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Best Pizza Style', 'best-pizza-style', 'The eternal pizza debate. Which style reigns supreme?', 7, v_admin_id, 'active', NOW() - interval '13 days', NOW() - interval '4 hours')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'New York Thin Crust', 0),
(uuid_generate_v4(), v_topic_id, 'Chicago Deep Dish', 1),
(uuid_generate_v4(), v_topic_id, 'Neapolitan', 2),
(uuid_generate_v4(), v_topic_id, 'Detroit Style', 3),
(uuid_generate_v4(), v_topic_id, 'Sicilian', 4);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'New York Thin Crust' THEN 10 WHEN 'Chicago Deep Dish' THEN 7 WHEN 'Neapolitan' THEN 9 WHEN 'Detroit Style' THEN 8 WHEN 'Sicilian' THEN 7 END,
  CASE o.name WHEN 'New York Thin Crust' THEN 'Fold it. Eat it walking. Perfection.' WHEN 'Chicago Deep Dish' THEN 'Its a casserole not a pizza but still delicious' ELSE NULL END,
  NOW() - interval '12 days' + (random() * interval '11 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'New York Thin Crust' THEN 9 WHEN 'Chicago Deep Dish' THEN 8 WHEN 'Neapolitan' THEN 10 WHEN 'Detroit Style' THEN 9 WHEN 'Sicilian' THEN 6 END,
  CASE o.name WHEN 'Neapolitan' THEN 'San Marzano tomatoes + buffalo mozzarella = heaven' ELSE NULL END,
  NOW() - interval '9 days' + (random() * interval '8 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'New York Thin Crust' THEN 8 WHEN 'Chicago Deep Dish' THEN 9 WHEN 'Neapolitan' THEN 8 WHEN 'Detroit Style' THEN 10 WHEN 'Sicilian' THEN 7 END,
  CASE o.name WHEN 'Detroit Style' THEN 'Those crispy cheese edges are criminally underrated' ELSE NULL END,
  NOW() - interval '5 days' + (random() * interval '4 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'New York Thin Crust' THEN 9 WHEN 'Chicago Deep Dish' THEN 8 WHEN 'Neapolitan' THEN 9 WHEN 'Detroit Style' THEN 8 WHEN 'Sicilian' THEN 8 END,
  NULL, NOW() - interval '2 days' + (random() * interval '1 day')
FROM options o WHERE o.topic_id = v_topic_id;

-- ============ MUSIC ============

-- 11. Best Album of 2025
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Best Album of 2025', 'best-album-of-2025', 'Which album defined 2025? The year in music, ranked.', 4, v_alex_id, 'active', NOW() - interval '5 days', NOW() - interval '3 hours')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'Kendrick Lamar - GNX', 0),
(uuid_generate_v4(), v_topic_id, 'Taylor Swift - The Anthology', 1),
(uuid_generate_v4(), v_topic_id, 'SZA - Lana', 2),
(uuid_generate_v4(), v_topic_id, 'Tyler, the Creator - Chromakopia', 3),
(uuid_generate_v4(), v_topic_id, 'Bad Bunny - DtMF', 4);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'Kendrick Lamar - GNX' THEN 10 WHEN 'Taylor Swift - The Anthology' THEN 7 WHEN 'SZA - Lana' THEN 9 WHEN 'Tyler, the Creator - Chromakopia' THEN 9 WHEN 'Bad Bunny - DtMF' THEN 8 END,
  CASE o.name WHEN 'Kendrick Lamar - GNX' THEN 'AOTY easy. Every track is a statement.' ELSE NULL END,
  NOW() - interval '4 days' + (random() * interval '3 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'Kendrick Lamar - GNX' THEN 9 WHEN 'Taylor Swift - The Anthology' THEN 10 WHEN 'SZA - Lana' THEN 10 WHEN 'Tyler, the Creator - Chromakopia' THEN 8 WHEN 'Bad Bunny - DtMF' THEN 7 END,
  CASE o.name WHEN 'SZA - Lana' THEN 'Her voice is a religious experience on this album' ELSE NULL END,
  NOW() - interval '3 days' + (random() * interval '2 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'Kendrick Lamar - GNX' THEN 10 WHEN 'Taylor Swift - The Anthology' THEN 6 WHEN 'SZA - Lana' THEN 8 WHEN 'Tyler, the Creator - Chromakopia' THEN 10 WHEN 'Bad Bunny - DtMF' THEN 9 END,
  CASE o.name WHEN 'Tyler, the Creator - Chromakopia' THEN 'Production is insane. Tyler keeps evolving.' ELSE NULL END,
  NOW() - interval '2 days' + (random() * interval '1 day')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'Kendrick Lamar - GNX' THEN 9 WHEN 'Taylor Swift - The Anthology' THEN 8 WHEN 'SZA - Lana' THEN 9 WHEN 'Tyler, the Creator - Chromakopia' THEN 8 WHEN 'Bad Bunny - DtMF' THEN 10 END,
  NULL, NOW() - interval '1 day' + (random() * interval '12 hours')
FROM options o WHERE o.topic_id = v_topic_id;

-- 12. Greatest Rapper Ever
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Greatest Rapper of All Time', 'greatest-rapper-of-all-time', 'The eternal hip-hop GOAT debate. Who holds the crown?', 4, v_sam_id, 'active', NOW() - interval '14 days', NOW() - interval '1 hour')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'Kendrick Lamar', 0),
(uuid_generate_v4(), v_topic_id, 'Kanye West', 1),
(uuid_generate_v4(), v_topic_id, 'Jay-Z', 2),
(uuid_generate_v4(), v_topic_id, 'Nas', 3),
(uuid_generate_v4(), v_topic_id, 'Eminem', 4),
(uuid_generate_v4(), v_topic_id, 'Tupac', 5),
(uuid_generate_v4(), v_topic_id, 'Biggie', 6),
(uuid_generate_v4(), v_topic_id, 'Drake', 7);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'Kendrick Lamar' THEN 10 WHEN 'Kanye West' THEN 8 WHEN 'Jay-Z' THEN 9 WHEN 'Nas' THEN 9 WHEN 'Eminem' THEN 7 WHEN 'Tupac' THEN 9 WHEN 'Biggie' THEN 9 WHEN 'Drake' THEN 5 END,
  CASE o.name WHEN 'Kendrick Lamar' THEN 'After the Drake beef its not even a debate anymore' WHEN 'Drake' THEN 'Great hitmaker but not a GOAT rapper. Sorry.' ELSE NULL END,
  NOW() - interval '13 days' + (random() * interval '12 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'Kendrick Lamar' THEN 10 WHEN 'Kanye West' THEN 9 WHEN 'Jay-Z' THEN 10 WHEN 'Nas' THEN 8 WHEN 'Eminem' THEN 8 WHEN 'Tupac' THEN 9 WHEN 'Biggie' THEN 10 WHEN 'Drake' THEN 6 END,
  CASE o.name WHEN 'Biggie' THEN 'Ready to Die is the greatest rap album ever made. Period.' ELSE NULL END,
  NOW() - interval '10 days' + (random() * interval '9 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'Kendrick Lamar' THEN 10 WHEN 'Kanye West' THEN 10 WHEN 'Jay-Z' THEN 8 WHEN 'Nas' THEN 10 WHEN 'Eminem' THEN 7 WHEN 'Tupac' THEN 10 WHEN 'Biggie' THEN 9 WHEN 'Drake' THEN 4 END,
  CASE o.name WHEN 'Nas' THEN 'Illmatic alone puts him top 3 forever' WHEN 'Kanye West' THEN 'Producer + rapper combo is unmatched in history' ELSE NULL END,
  NOW() - interval '7 days' + (random() * interval '6 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'Kendrick Lamar' THEN 9 WHEN 'Kanye West' THEN 7 WHEN 'Jay-Z' THEN 9 WHEN 'Nas' THEN 8 WHEN 'Eminem' THEN 9 WHEN 'Tupac' THEN 10 WHEN 'Biggie' THEN 9 WHEN 'Drake' THEN 7 END,
  CASE o.name WHEN 'Tupac' THEN 'Changed the world with music. Thats GOAT status.' ELSE NULL END,
  NOW() - interval '3 days' + (random() * interval '2 days')
FROM options o WHERE o.topic_id = v_topic_id;

-- ============ CULTURE ============

-- 13. Best Social Media Platform
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Best Social Media Platform', 'best-social-media-platform', 'Where do you actually spend your time online?', 8, v_admin_id, 'active', NOW() - interval '8 days', NOW() - interval '30 minutes')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'TikTok', 0),
(uuid_generate_v4(), v_topic_id, 'Instagram', 1),
(uuid_generate_v4(), v_topic_id, 'X (Twitter)', 2),
(uuid_generate_v4(), v_topic_id, 'Reddit', 3),
(uuid_generate_v4(), v_topic_id, 'YouTube', 4),
(uuid_generate_v4(), v_topic_id, 'Threads', 5);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'TikTok' THEN 7 WHEN 'Instagram' THEN 6 WHEN 'X (Twitter)' THEN 5 WHEN 'Reddit' THEN 9 WHEN 'YouTube' THEN 10 WHEN 'Threads' THEN 4 END,
  CASE o.name WHEN 'YouTube' THEN 'Only platform thats genuinely gotten BETTER over time' WHEN 'X (Twitter)' THEN 'RIP old twitter. Its a wasteland now.' ELSE NULL END,
  NOW() - interval '7 days' + (random() * interval '6 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'TikTok' THEN 9 WHEN 'Instagram' THEN 8 WHEN 'X (Twitter)' THEN 6 WHEN 'Reddit' THEN 8 WHEN 'YouTube' THEN 9 WHEN 'Threads' THEN 5 END,
  CASE o.name WHEN 'TikTok' THEN 'Algorithm is scary good. I lose hours daily.' ELSE NULL END,
  NOW() - interval '5 days' + (random() * interval '4 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'TikTok' THEN 6 WHEN 'Instagram' THEN 7 WHEN 'X (Twitter)' THEN 4 WHEN 'Reddit' THEN 10 WHEN 'YouTube' THEN 10 WHEN 'Threads' THEN 3 END,
  CASE o.name WHEN 'Reddit' THEN 'Best place for actual discussions. Every other app is just content consumption.' ELSE NULL END,
  NOW() - interval '3 days' + (random() * interval '2 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'TikTok' THEN 8 WHEN 'Instagram' THEN 9 WHEN 'X (Twitter)' THEN 7 WHEN 'Reddit' THEN 7 WHEN 'YouTube' THEN 9 WHEN 'Threads' THEN 6 END,
  NULL, NOW() - interval '1 day' + (random() * interval '12 hours')
FROM options o WHERE o.topic_id = v_topic_id;

-- 14. Best Productivity Tool
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Best Productivity Tool', 'best-productivity-tool', 'Which tool actually makes you more productive vs just feeling productive?', 8, v_alex_id, 'active', NOW() - interval '6 days', NOW() - interval '5 hours')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'Notion', 0),
(uuid_generate_v4(), v_topic_id, 'Linear', 1),
(uuid_generate_v4(), v_topic_id, 'Obsidian', 2),
(uuid_generate_v4(), v_topic_id, 'Arc Browser', 3),
(uuid_generate_v4(), v_topic_id, 'Raycast', 4),
(uuid_generate_v4(), v_topic_id, 'Things 3', 5);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'Notion' THEN 8 WHEN 'Linear' THEN 9 WHEN 'Obsidian' THEN 10 WHEN 'Arc Browser' THEN 7 WHEN 'Raycast' THEN 9 WHEN 'Things 3' THEN 7 END,
  CASE o.name WHEN 'Obsidian' THEN 'Local-first + plugins + markdown = perfect PKM' ELSE NULL END,
  NOW() - interval '5 days' + (random() * interval '4 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'Notion' THEN 9 WHEN 'Linear' THEN 10 WHEN 'Obsidian' THEN 8 WHEN 'Arc Browser' THEN 9 WHEN 'Raycast' THEN 10 WHEN 'Things 3' THEN 6 END,
  CASE o.name WHEN 'Linear' THEN 'Finally an issue tracker that doesnt make me want to die' WHEN 'Raycast' THEN 'Replaced Spotlight, Alfred, and 5 other apps' ELSE NULL END,
  NOW() - interval '4 days' + (random() * interval '3 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'Notion' THEN 7 WHEN 'Linear' THEN 9 WHEN 'Obsidian' THEN 9 WHEN 'Arc Browser' THEN 8 WHEN 'Raycast' THEN 8 WHEN 'Things 3' THEN 9 END,
  CASE o.name WHEN 'Things 3' THEN 'Simple. Beautiful. Actually gets out of your way.' ELSE NULL END,
  NOW() - interval '2 days' + (random() * interval '1 day')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'Notion' THEN 10 WHEN 'Linear' THEN 8 WHEN 'Obsidian' THEN 7 WHEN 'Arc Browser' THEN 8 WHEN 'Raycast' THEN 7 WHEN 'Things 3' THEN 8 END,
  NULL, NOW() - interval '1 day' + (random() * interval '12 hours')
FROM options o WHERE o.topic_id = v_topic_id;

-- ============ GAMING ============

-- 15. Best Video Game of All Time
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Best Video Game of All Time', 'best-video-game-of-all-time', 'One game. All time. What is the greatest ever made?', 5, v_jordan_id, 'active', NOW() - interval '12 days', NOW() - interval '2 hours')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'Zelda: Breath of the Wild', 0),
(uuid_generate_v4(), v_topic_id, 'Elden Ring', 1),
(uuid_generate_v4(), v_topic_id, 'GTA V', 2),
(uuid_generate_v4(), v_topic_id, 'Minecraft', 3),
(uuid_generate_v4(), v_topic_id, 'The Witcher 3', 4),
(uuid_generate_v4(), v_topic_id, 'Red Dead Redemption 2', 5);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'Zelda: Breath of the Wild' THEN 10 WHEN 'Elden Ring' THEN 10 WHEN 'GTA V' THEN 8 WHEN 'Minecraft' THEN 9 WHEN 'The Witcher 3' THEN 9 WHEN 'Red Dead Redemption 2' THEN 10 END,
  CASE o.name WHEN 'Red Dead Redemption 2' THEN 'Arthur Morgan made me cry. A grown man. Crying at a video game.' ELSE NULL END,
  NOW() - interval '11 days' + (random() * interval '10 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'Zelda: Breath of the Wild' THEN 10 WHEN 'Elden Ring' THEN 9 WHEN 'GTA V' THEN 9 WHEN 'Minecraft' THEN 10 WHEN 'The Witcher 3' THEN 8 WHEN 'Red Dead Redemption 2' THEN 9 END,
  CASE o.name WHEN 'Minecraft' THEN 'Infinite creativity. Still relevant 15 years later. Thats GOAT behavior.' ELSE NULL END,
  NOW() - interval '8 days' + (random() * interval '7 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'Zelda: Breath of the Wild' THEN 9 WHEN 'Elden Ring' THEN 10 WHEN 'GTA V' THEN 8 WHEN 'Minecraft' THEN 8 WHEN 'The Witcher 3' THEN 10 WHEN 'Red Dead Redemption 2' THEN 9 END,
  CASE o.name WHEN 'Elden Ring' THEN 'Miyazaki + GRRM open world is peak game design' WHEN 'The Witcher 3' THEN 'Best side quests in any RPG ever. Main story is just a bonus.' ELSE NULL END,
  NOW() - interval '5 days' + (random() * interval '4 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'Zelda: Breath of the Wild' THEN 10 WHEN 'Elden Ring' THEN 9 WHEN 'GTA V' THEN 10 WHEN 'Minecraft' THEN 9 WHEN 'The Witcher 3' THEN 9 WHEN 'Red Dead Redemption 2' THEN 10 END,
  NULL, NOW() - interval '2 days' + (random() * interval '1 day')
FROM options o WHERE o.topic_id = v_topic_id;

-- 16. Best Gaming Console
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Best Gaming Console 2026', 'best-gaming-console-2026', 'Console wars are back. Which platform wins in 2026?', 5, v_sam_id, 'active', NOW() - interval '4 days', NOW() - interval '6 hours')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'PlayStation 5', 0),
(uuid_generate_v4(), v_topic_id, 'Xbox Series X', 1),
(uuid_generate_v4(), v_topic_id, 'Nintendo Switch 2', 2),
(uuid_generate_v4(), v_topic_id, 'Steam Deck', 3),
(uuid_generate_v4(), v_topic_id, 'PC Master Race', 4);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'PlayStation 5' THEN 9 WHEN 'Xbox Series X' THEN 7 WHEN 'Nintendo Switch 2' THEN 9 WHEN 'Steam Deck' THEN 8 WHEN 'PC Master Race' THEN 10 END,
  CASE o.name WHEN 'PC Master Race' THEN '4K 144fps or nothing. Console peasants stay mad.' ELSE NULL END,
  NOW() - interval '3 days' + (random() * interval '2 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'PlayStation 5' THEN 8 WHEN 'Xbox Series X' THEN 8 WHEN 'Nintendo Switch 2' THEN 10 WHEN 'Steam Deck' THEN 9 WHEN 'PC Master Race' THEN 9 END,
  CASE o.name WHEN 'Nintendo Switch 2' THEN 'Portable + docked with actual power now? Game over.' WHEN 'Steam Deck' THEN 'Entire Steam library in your hands. Gabe delivers.' ELSE NULL END,
  NOW() - interval '2 days' + (random() * interval '1 day')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'PlayStation 5' THEN 10 WHEN 'Xbox Series X' THEN 7 WHEN 'Nintendo Switch 2' THEN 8 WHEN 'Steam Deck' THEN 9 WHEN 'PC Master Race' THEN 9 END,
  CASE o.name WHEN 'PlayStation 5' THEN 'Exclusives win generations. Spider-Man 2, God of War...' ELSE NULL END,
  NOW() - interval '1 day' + (random() * interval '12 hours')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'PlayStation 5' THEN 8 WHEN 'Xbox Series X' THEN 9 WHEN 'Nintendo Switch 2' THEN 9 WHEN 'Steam Deck' THEN 8 WHEN 'PC Master Race' THEN 8 END,
  NULL, NOW() - interval '12 hours' + (random() * interval '6 hours')
FROM options o WHERE o.topic_id = v_topic_id;

-- ============ POLITICS & NEWS ============

-- 17. Most Impactful Tech Company
INSERT INTO topics (id, title, slug, description, category_id, creator_id, status, created_at, last_activity)
VALUES (uuid_generate_v4(), 'Most Impactful Tech Company', 'most-impactful-tech-company', 'Which company is shaping the future the most right now?', 6, v_admin_id, 'active', NOW() - interval '10 days', NOW() - interval '1 hour')
RETURNING id INTO v_topic_id;

INSERT INTO options (id, topic_id, name, sort_order) VALUES
(uuid_generate_v4(), v_topic_id, 'Apple', 0),
(uuid_generate_v4(), v_topic_id, 'Google', 1),
(uuid_generate_v4(), v_topic_id, 'Microsoft', 2),
(uuid_generate_v4(), v_topic_id, 'Nvidia', 3),
(uuid_generate_v4(), v_topic_id, 'OpenAI', 4),
(uuid_generate_v4(), v_topic_id, 'Meta', 5),
(uuid_generate_v4(), v_topic_id, 'Amazon', 6);

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_admin_id, CASE o.name WHEN 'Apple' THEN 8 WHEN 'Google' THEN 8 WHEN 'Microsoft' THEN 9 WHEN 'Nvidia' THEN 10 WHEN 'OpenAI' THEN 9 WHEN 'Meta' THEN 7 WHEN 'Amazon' THEN 8 END,
  CASE o.name WHEN 'Nvidia' THEN 'Jensen literally powers the AI revolution. No Nvidia = no AI.' ELSE NULL END,
  NOW() - interval '9 days' + (random() * interval '8 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_alex_id, CASE o.name WHEN 'Apple' THEN 9 WHEN 'Google' THEN 7 WHEN 'Microsoft' THEN 8 WHEN 'Nvidia' THEN 10 WHEN 'OpenAI' THEN 10 WHEN 'Meta' THEN 6 WHEN 'Amazon' THEN 7 END,
  CASE o.name WHEN 'OpenAI' THEN 'ChatGPT changed how the entire world works in 2 years' ELSE NULL END,
  NOW() - interval '6 days' + (random() * interval '5 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_sam_id, CASE o.name WHEN 'Apple' THEN 7 WHEN 'Google' THEN 9 WHEN 'Microsoft' THEN 9 WHEN 'Nvidia' THEN 10 WHEN 'OpenAI' THEN 8 WHEN 'Meta' THEN 8 WHEN 'Amazon' THEN 9 END,
  CASE o.name WHEN 'Microsoft' THEN 'Satya turned them from has-been to AI leader. Respect.' ELSE NULL END,
  NOW() - interval '4 days' + (random() * interval '3 days')
FROM options o WHERE o.topic_id = v_topic_id;

INSERT INTO ratings (option_id, user_id, score, comment, created_at)
SELECT o.id, v_jordan_id, CASE o.name WHEN 'Apple' THEN 10 WHEN 'Google' THEN 8 WHEN 'Microsoft' THEN 8 WHEN 'Nvidia' THEN 9 WHEN 'OpenAI' THEN 9 WHEN 'Meta' THEN 7 WHEN 'Amazon' THEN 8 END,
  CASE o.name WHEN 'Apple' THEN 'Ecosystem lock-in is scary but the products just work' ELSE NULL END,
  NOW() - interval '1 day' + (random() * interval '12 hours')
FROM options o WHERE o.topic_id = v_topic_id;

-- ============ UPDATE DENORMALIZED FIELDS ============

-- Update options: avg_rating and rating_count
UPDATE options SET
  avg_rating = sub.avg_score,
  rating_count = sub.cnt
FROM (
  SELECT option_id, AVG(score)::float as avg_score, COUNT(*)::int as cnt
  FROM ratings
  GROUP BY option_id
) sub
WHERE options.id = sub.option_id;

-- Update topics: total_ratings and trending_score
UPDATE topics SET
  total_ratings = sub.total,
  trending_score = sub.total * 2.5 + (EXTRACT(EPOCH FROM (topics.last_activity - NOW() + interval '14 days')) / 3600.0)
FROM (
  SELECT o.topic_id, SUM(o.rating_count) as total
  FROM options o
  GROUP BY o.topic_id
) sub
WHERE topics.id = sub.topic_id;

END;
$$;
