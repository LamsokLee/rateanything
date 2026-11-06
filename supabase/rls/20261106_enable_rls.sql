-- Security fix for Supabase advisor finding rls_disabled_in_public.
-- RateAnything accesses Postgres only server-side through Drizzle/DATABASE_URL.
-- The app does not use Supabase Data API clients, so the minimum safe policy
-- set for anon/authenticated is: no policies (deny Data API reads/writes).
-- Do not FORCE RLS: the server-side postgres role uses BYPASSRLS.

begin;

alter table public.arena_votes enable row level security;
alter table public.badges enable row level security;
alter table public.categories enable row level security;
alter table public.collection_items enable row level security;
alter table public.collections enable row level security;
alter table public.comment_votes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.guests enable row level security;
alter table public.notifications enable row level security;
alter table public.option_elo_stats enable row level security;
alter table public.options enable row level security;
alter table public.ratings enable row level security;
alter table public.reports enable row level security;
alter table public.topics enable row level security;
alter table public.user_badges enable row level security;
alter table public.users enable row level security;

commit;
