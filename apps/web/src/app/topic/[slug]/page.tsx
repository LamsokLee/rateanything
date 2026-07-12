/**
 * Topic detail page — Time-series focused layout.
 * Hero chart (score history) as the main visual, options as a clean
 * leaderboard table with inline compact vote buttons.
 * Feels like a financial comparison chart page (Yahoo Finance).
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { safeAuth } from "@/lib/safe-auth";
import { getServerCaller } from "@/lib/server-trpc";
import { CHART_COLORS } from "@/lib/chart-colors";
import { RatingHistoryChart } from "@/components/RatingHistoryChart";
import { InlineRatingButtons } from "@/components/InlineRatingButtons";
import { CommentSection } from "@/components/CommentSection";

interface TopicPageProps {
  params: { slug: string };
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  tech: { bg: "rgba(59, 130, 246, 0.12)", text: "#3b82f6" },
  food: { bg: "rgba(249, 115, 22, 0.12)", text: "#f97316" },
  sports: { bg: "rgba(34, 197, 94, 0.12)", text: "#22c55e" },
  culture: { bg: "rgba(168, 85, 247, 0.12)", text: "#a855f7" },
  "movies-tv": { bg: "rgba(236, 72, 153, 0.12)", text: "#ec4899" },
  gaming: { bg: "rgba(139, 92, 246, 0.12)", text: "#8b5cf6" },
  "politics-news": { bg: "rgba(239, 68, 68, 0.12)", text: "#ef4444" },
  music: { bg: "rgba(251, 191, 36, 0.12)", text: "#fbbf24" },
};

function formatRelativeTime(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}


/** Generate OpenGraph + Twitter meta tags for topic pages */
export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { slug } = params;
  try {
    const clerkAuth = await safeAuth();
    const caller = await getServerCaller(clerkAuth?.userId ?? undefined);
    const topic = await caller.topics.getBySlug({ slug });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rateanything.com";
    const title = topic.title;
    const description = topic.description ?? `Rate and compare options for: ${topic.title}`;
    const url = `${baseUrl}/topic/${slug}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        url,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch {
    return { title: "Topic not found" };
  }
}

export default async function TopicPage({ params }: TopicPageProps) {
  let topic: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerCaller>>["topics"]["getBySlug"]>
  > | null = null;
  let historyData: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerCaller>>["topics"]["ratingHistory"]>
  > | null = null;

  const { slug } = params;
  try {
    const clerkAuth = await safeAuth();
    const caller = await getServerCaller(clerkAuth?.userId ?? undefined);
    topic = await caller.topics.getBySlug({ slug });
    try {
      historyData = await caller.topics.ratingHistory({ topicId: topic.id });
    } catch {
      historyData = null;
    }
  } catch {
    notFound();
  }

  if (!topic) {
    notFound();
  }

  const categoryColors = CATEGORY_COLORS[topic.category?.slug ?? ""] ?? {
    bg: "rgba(161, 161, 170, 0.12)",
    text: "#a1a1aa",
  };

  // Sort options by avgRating DESC for ranked display
  const sortedOptions = [...topic.options].sort(
    (a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0)
  );

  const totalVotes = sortedOptions.reduce(
    (sum, o) => sum + (o.ratingCount ?? 0),
    0
  );

  // Map option IDs to chart color index (based on history data order)
  const optionColorMap: Record<string, string> = {};
  if (historyData) {
    historyData.options.forEach((opt, idx) => {
      optionColorMap[opt.optionId] = CHART_COLORS[idx % CHART_COLORS.length];
    });
  }

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─── */}
      <header className="space-y-2 border-b border-border/60 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          <h1 className="text-lg sm:text-xl font-bold text-foreground leading-tight">
            {topic.title}
          </h1>
          <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
            {topic.category && (
              <Link
                href={`/category/${topic.category.slug}`}
                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium transition-opacity hover:opacity-80"
                style={{
                  background: categoryColors.bg,
                  color: categoryColors.text,
                }}
              >
                {topic.category.name}
              </Link>
            )}
            <span className="text-subtle/70 hidden sm:inline">•</span>
            <span className="font-mono">{totalVotes} votes</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-subtle flex-wrap">
          {topic.creator && (
            <span className="text-muted-foreground">
              Created by @{topic.creator.username}
            </span>
          )}
          {topic.createdAt && (
            <>
              <span className="text-subtle/50">•</span>
              <span>{formatRelativeTime(topic.createdAt)}</span>
            </>
          )}
        </div>

        {topic.description && (
          <p className="text-sm text-subtle max-w-2xl leading-relaxed">
            {topic.description}
          </p>
        )}
      </header>

      {/* ─── HERO CHART ─── */}
      {historyData && historyData.options.length > 0 && (
        <section className="border border-border/60 rounded-lg bg-card/90 p-5">
          <RatingHistoryChart data={historyData.options} />
        </section>
      )}

      {/* ─── OPTIONS TABLE ─── */}
      <section>
        {/* Mobile: card layout */}
        <div className="md:hidden space-y-3">
          {sortedOptions.map((option, index) => {
            const score = option.avgRating ?? 0;
            const hasRatings = (option.ratingCount ?? 0) > 0;
            const optColor =
              optionColorMap[option.id] ??
              CHART_COLORS[index % CHART_COLORS.length];

            return (
              <div
                key={option.id}
                className="border border-border/60 rounded-lg bg-card/80 p-4 space-y-3"
              >
                {/* Option header: rank + name */}
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono text-subtle w-5 text-center">
                    {index + 1}
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: optColor }}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {option.name}
                  </span>
                </div>

                {/* Score + votes row */}
                <div className="flex items-center justify-between pl-7">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {hasRatings ? score.toFixed(1) : "\u2014"}
                    </span>
                    <span className="font-mono text-xs text-subtle">
                      {option.ratingCount ?? 0} votes
                    </span>
                  </div>
                </div>

                {/* Vote buttons */}
                <div className="pl-7">
                  <InlineRatingButtons
                    optionId={option.id}
                    currentUserRating={option.userRating}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: table layout */}
        <div className="hidden md:block border border-border/60 rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem_auto] gap-3 items-center px-4 py-2.5 bg-card border-b border-border/60 text-[11px] uppercase tracking-wider font-medium text-subtle">
            <span>#</span>
            <span>Option</span>
            <span className="text-right">Score</span>
            <span className="text-right">Votes</span>
            <span className="text-center">Your Vote</span>
          </div>

          {/* Table rows */}
          {sortedOptions.map((option, index) => {
            const score = option.avgRating ?? 0;
            const hasRatings = (option.ratingCount ?? 0) > 0;
            const optColor =
              optionColorMap[option.id] ??
              CHART_COLORS[index % CHART_COLORS.length];

            return (
              <div
                key={option.id}
                className="grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem_auto] gap-3 items-center px-4 py-3 border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors duration-100"
              >
                {/* Rank */}
                <span className="text-xs font-mono text-subtle/70">
                  {index + 1}
                </span>

                {/* Option name with color dot */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: optColor }}
                  />
                  <span className="text-sm text-foreground truncate">
                    {option.name}
                  </span>
                </div>

                {/* Score */}
                <span className="text-right font-mono text-sm font-semibold text-foreground">
                  {hasRatings ? score.toFixed(1) : "\u2014"}
                </span>

                {/* Vote count */}
                <span className="text-right font-mono text-xs text-subtle">
                  {option.ratingCount ?? 0}
                </span>

                {/* Inline vote buttons */}
                <div className="flex justify-center">
                  <InlineRatingButtons
                    optionId={option.id}
                    currentUserRating={option.userRating}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── COMMENT SECTION ─── */}
      <CommentSection topicId={topic.id} />
    </div>
  );
}
