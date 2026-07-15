/**
 * User profile page — shows rating history and comment history as tabs.
 * Server component that fetches user data and renders profile + activity tabs.
 */
import { notFound } from "next/navigation";
import { getServerCaller } from "@/lib/server-trpc";
import { UserActivityTabs } from "@/components/UserActivityTabs";
import { formatDate } from "@/lib/format-date";

interface UserPageProps {
  params: { username: string };
}
export default async function UserPage({ params }: UserPageProps) {
  const { username } = params;

  let profile: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerCaller>>["users"]["getProfile"]>
  > | null = null;
  let historyResult: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerCaller>>["users"]["getRatingHistory"]>
  > | null = null;
  let commentResult: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerCaller>>["users"]["getCommentHistory"]>
  > | null = null;
  let createdTopicsResult: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerCaller>>["users"]["getCreatedTopics"]>
  > | null = null;
  let arenaVoteResult: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerCaller>>["users"]["getArenaVoteHistory"]>
  > | null = null;

  try {
    const caller = await getServerCaller();
    profile = await caller.users.getProfile({ username });
    historyResult = await caller.users.getRatingHistory({ username, limit: 20 });
    commentResult = await caller.users.getCommentHistory({ username, limit: 20 });
    createdTopicsResult = await caller.users.getCreatedTopics({ username, limit: 20 });
  } catch {
    notFound();
  }

  // Arena votes degrade gracefully to empty rather than 404ing the entire profile
  try {
    const caller = await getServerCaller();
    arenaVoteResult = await caller.users.getArenaVoteHistory({ username, limit: 20 });
  } catch {
    arenaVoteResult = null;
  }

  if (!profile) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* ─── PROFILE HEADER ─── */}
      <header className="border-b border-border/60 pb-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-muted border border-input flex items-center justify-center text-base sm:text-lg font-bold text-muted-foreground shrink-0">
            {profile.username.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-foreground">@{profile.username}</h1>
            {profile.bio && (
              <p className="text-sm text-muted-foreground">{profile.bio}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-subtle flex-wrap">
          <span className="font-mono">
            <span className="text-foreground/80 font-semibold">{profile.ratingCount}</span> ratings given
          </span>
          <span className="text-subtle/50">•</span>
          <span>Joined {formatDate(profile.createdAt)}</span>
          {profile.location && (
            <>
              <span className="text-subtle/50">•</span>
              <span>{profile.location}</span>
            </>
          )}
        </div>
      </header>

      {/* ─── ACTIVITY TABS (Votes | Comments | Topics) ─── */}
      <section>
        <UserActivityTabs
          username={username}
          initialRatingItems={historyResult?.items ?? []}
          initialRatingCursor={historyResult?.nextCursor ?? null}
          initialArenaVoteItems={arenaVoteResult?.items ?? []}
          initialArenaVoteCursor={arenaVoteResult?.nextCursor ?? null}
          initialCommentItems={commentResult?.items ?? []}
          initialCommentCursor={commentResult?.nextCursor ?? null}
          initialCreatedTopics={createdTopicsResult?.items ?? []}
        />
      </section>
    </div>
  );
}
