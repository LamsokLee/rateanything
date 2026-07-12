/**
 * Topic detail page — Polished comparison dashboard.
 * Hero chart, ranked options table with aligned columns, per-option
 * trend sparklines, and inline voting.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { safeAuth } from "@/lib/safe-auth";
import { getServerCaller } from "@/lib/server-trpc";
import { CHART_COLORS } from "@/lib/chart-colors";
import { RatingHistoryChart } from "@/components/RatingHistoryChart";
import { InlineRatingButtons } from "@/components/InlineRatingButtons";
import { Sparkline } from "@/components/Sparkline";
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

function getRankBadge(index: number): { bg: string; text: string } | null {
  if (index === 0) return { bg: "#fbbf24", text: "#451a03" }; // gold
  if (index === 1) return { bg: "#9ca3af", text: "#111827" }; // silver
  if (index === 2) return { bg: "#b45309", text: "#ffffff" }; // bronze
  return null;
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
  const historyByOption: Record<string, { timestamp: string; avgScore: number; count: number }[]> = {};
  if (historyData) {
    historyData.options.forEach((opt, idx) => {
      optionColorMap[opt.optionId] = CHART_COLORS[idx % CHART_COLORS.length];
      historyByOption[opt.optionId] = opt.history;
    });
  }

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─── */}
      <header className="border border-border/60 rounded-xl bg-card/60 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="space-y-2 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
              {topic.title}
            </h1>
            {topic.description && (
              <p className="text-sm text-subtle leading-relaxed max-w-2xl">
                {topic.description}
              </p>
            )}
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
            {topic.category && (
              <Link
                href={`/category/${topic.category.slug}`}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold transition-opacity hover:opacity-80"
                style={{
                  background: categoryColors.bg,
                  color: categoryColors.text,
                }}
              >
                {topic.category.name}
              </Link>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 text-[11px] text-subtle/70 flex-wrap border-t border-border/40 pt-3">
          {topic.creator && (
            <span className="text-muted-foreground">
              Created by @{topic.creator.username}
            </span>
          )}
          {topic.createdAt && (
            <>
              <span className="text-subtle/30">•</span>
              <span>{formatRelativeTime(topic.createdAt)}</span>
            </>
          )}
          <span className="text-subtle/30">•</span>
          <span className="font-mono">{totalVotes.toLocaleString()} votes</span>
        </div>
      </header>

      {/* ─── OPTIONS TABLE ─── */}
      <section className="border border-border/60 rounded-xl bg-card/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 bg-card/80">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Options
            </h2>
            <span className="text-xs text-muted-foreground">
              Ranked by average rating
            </span>
          </div>
        </div>

        {/* Mobile: card layout */}
        <div className="md:hidden divide-y divide-border/40">
          {sortedOptions.map((option, index) => {
            const score = option.avgRating ?? 0;
            const hasRatings = (option.ratingCount ?? 0) > 0;
            const optColor =
              optionColorMap[option.id] ??
              CHART_COLORS[index % CHART_COLORS.length];
            const rankBadge = getRankBadge(index);

            return (
              <div
                key={option.id}
                className="p-4 hover:bg-muted/20 transition-colors duration-100"
              >
                {/* Option header: rank + name */}
                <div className="flex items-center gap-3">
                  {rankBadge ? (
                    <span
                      className="flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: rankBadge.bg, color: rankBadge.text }}
                    >
                      {index + 1}
                    </span>
                  ) : (
                    <span className="w-6 h-6 flex items-center justify-center text-xs font-mono text-subtle/70 shrink-0">
                      {index + 1}
                    </span>
                  )}
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: optColor }}
                  />
                  <span className="text-sm font-semibold text-foreground truncate">
                    {option.name}
                  </span>
                </div>

                {/* Score + votes + trend row */}
                <div className="flex items-center justify-between mt-3 pl-9">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="font-mono text-sm font-bold text-foreground">
                        {hasRatings ? score.toFixed(1) : "\u2014"}
                      </span>
                      <span className="font-mono text-[10px] text-subtle/50">
                        {option.ratingCount ?? 0} votes
                      </span>
                    </div>
                  </div>
                  {historyByOption[option.id]?.length >= 2 && (
                    <Sparkline
                      data={historyByOption[option.id]}
                      color={optColor}
                      width={72}
                      height={24}
                      showArea
                      showTrendIndicator={false}
                    />
                  )}
                </div>

                {/* Vote buttons */}
                <div className="mt-3 pl-9">
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
        <div className="hidden md:block">
          {/* Table header */}
          <div className="grid grid-cols-[2.5rem_1fr_5rem_6rem_19.5rem] gap-3 items-center px-5 py-3 bg-card/80 border-b border-border/60 text-[10px] uppercase tracking-wider font-semibold text-subtle/70">
            <span className="text-center">#</span>
            <span>Option</span>
            <span className="text-right">Score</span>
            <span className="text-right">Trend</span>
            <span className="text-center">Your Rating</span>
          </div>

          {/* Table rows */}
          {sortedOptions.map((option, index) => {
            const score = option.avgRating ?? 0;
            const hasRatings = (option.ratingCount ?? 0) > 0;
            const optColor =
              optionColorMap[option.id] ??
              CHART_COLORS[index % CHART_COLORS.length];
            const rankBadge = getRankBadge(index);
            const history = historyByOption[option.id];

            return (
              <div
                key={option.id}
                className="grid grid-cols-[2.5rem_1fr_5rem_6rem_19.5rem] gap-3 items-center px-5 py-3.5 border-b border-border/30 last:border-b-0 hover:bg-muted/20 transition-colors duration-100"
              >
                {/* Rank */}
                <div className="flex justify-center">
                  {rankBadge ? (
                    <span
                      className="flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold"
                      style={{ backgroundColor: rankBadge.bg, color: rankBadge.text }}
                    >
                      {index + 1}
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-subtle/70">
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Option name with color dot */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: optColor }}
                  />
                  <span className="text-sm font-medium text-foreground truncate">
                    {option.name}
                  </span>
                </div>

                {/* Score */}
                <div className="text-right">
                  <span className="font-mono text-sm font-bold text-foreground">
                    {hasRatings ? score.toFixed(1) : "\u2014"}
                  </span>
                  <span className="block font-mono text-[10px] text-subtle/60">
                    {(option.ratingCount ?? 0).toLocaleString()} votes
                  </span>
                </div>

                {/* Trend sparkline */}
                <div className="flex justify-end">
                  {history && history.length >= 2 ? (
                    <Sparkline
                      data={history}
                      color={optColor}
                      width={76}
                      height={22}
                      showArea
                      showTrendIndicator={false}
                    />
                  ) : (
                    <span className="text-[10px] text-subtle/50 font-mono">—</span>
                  )}
                </div>


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

      {/* ─── SCORE HISTORY (collapsible) ─── */}
      {historyData && historyData.options.length > 0 && (
        <details className="border border-border/60 rounded-xl bg-card/90 group">
          <summary className="flex items-center gap-2 px-5 py-4 cursor-pointer select-none text-sm font-semibold text-foreground uppercase tracking-wide hover:bg-muted/20 transition-colors duration-100 list-none [&::-webkit-details-marker]:hidden">
            <svg
              className="w-4 h-4 text-subtle/70 transition-transform duration-200 group-open:rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Score history
          </summary>
          <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0">
            <RatingHistoryChart data={historyData.options} />
          </div>
        </details>
      )}

      {/* ─── COMMENT SECTION ─── */}
      <CommentSection topicId={topic.id} />
    </div>
  );
}
