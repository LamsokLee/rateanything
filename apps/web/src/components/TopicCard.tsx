"use client";

/**
 * TopicCard — Polymarket-inspired market card with mini sparkline,
 * top options with progress bars, urgency signals, and hover preview.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkline } from "@/components/Sparkline";

interface TopicCardProps {
  topic: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    totalRatings: number;
    trendingScore: number | null;
    categoryName: string | null;
    categorySlug: string | null;
    creatorUsername: string | null;
    createdAt: Date | string;
    topOptions?: { name: string; avgRating: number }[];
    optionCount?: number;
  };
  featured?: boolean;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  tech: { bg: "rgba(59, 130, 246, 0.12)", text: "#3b82f6", border: "#3b82f6" },
  food: { bg: "rgba(249, 115, 22, 0.12)", text: "#f97316", border: "#f97316" },
  sports: { bg: "rgba(34, 197, 94, 0.12)", text: "#22c55e", border: "#22c55e" },
  culture: { bg: "rgba(168, 85, 247, 0.12)", text: "#a855f7", border: "#a855f7" },
  "movies-tv": { bg: "rgba(236, 72, 153, 0.12)", text: "#ec4899", border: "#ec4899" },
  gaming: { bg: "rgba(139, 92, 246, 0.12)", text: "#8b5cf6", border: "#8b5cf6" },
  "politics-news": { bg: "rgba(239, 68, 68, 0.12)", text: "#ef4444", border: "#ef4444" },
  music: { bg: "rgba(251, 191, 36, 0.12)", text: "#fbbf24", border: "#fbbf24" },
};

function getBarColor(score: number): string {
  if (score >= 8) return "#22c55e";
  if (score >= 6) return "#3b82f6";
  if (score >= 4) return "#eab308";
  return "#ef4444";
}

function formatVoteCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

function isNewTopic(dateInput: Date | string): boolean {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  return now.getTime() - date.getTime() < 24 * 60 * 60 * 1000;
}

function isTrendingFast(trendingScore: number | null, totalRatings: number): boolean {
  return (trendingScore !== null && trendingScore > 5) || totalRatings > 20;
}

/** Generate fake sparkline data based on the score (deterministic from topic id) */
function generateSparklineData(topicId: string, currentScore: number): number[] {
  let seed = 0;
  for (let i = 0; i < topicId.length; i++) {
    seed = ((seed << 5) - seed + topicId.charCodeAt(i)) | 0;
  }
  const pseudoRandom = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return (seed >>> 16) / 65536;
  };

  const points: number[] = [];
  const baseScore = Math.max(1, currentScore - 1.5);
  for (let i = 0; i < 7; i++) {
    const variation = (pseudoRandom() - 0.5) * 2;
    points.push(Math.min(10, Math.max(1, baseScore + variation + (i / 6) * 1.5)));
  }
  points[points.length - 1] = currentScore;
  return points;
}

/** Find the most divisive option for the tooltip preview */
function getMostDivisivePreview(options: { name: string; avgRating: number }[]): string | null {
  if (options.length < 2) return null;
  const scores = options.filter((o) => o.avgRating > 0);
  if (scores.length < 2) return null;
  const midOption = scores.reduce((prev, curr) =>
    Math.abs(curr.avgRating - 5) < Math.abs(prev.avgRating - 5) ? curr : prev
  );
  return `Most divisive: ${midOption.name} at ${midOption.avgRating.toFixed(1)}`;
}

export function TopicCard({ topic, featured = false }: TopicCardProps) {
  const router = useRouter();
  const colors = CATEGORY_COLORS[topic.categorySlug ?? ""] ?? {
    bg: "rgba(161, 161, 170, 0.12)",
    text: "#a1a1aa",
    border: "#52525b",
  };

  const topOptions = topic.topOptions ?? [];
  const displayCount = featured ? 5 : 3;
  const displayOptions = topOptions.slice(0, displayCount);
  const topScore = topOptions[0]?.avgRating ?? 0;
  const sparklineData = topScore > 0 ? generateSparklineData(topic.id, topScore) : [];

  const isNew = isNewTopic(topic.createdAt);
  const isTrending = isTrendingFast(topic.trendingScore, topic.totalRatings);
  const divisivePreview = getMostDivisivePreview(topOptions);

  return (
    <Link
      href={`/topic/${topic.slug}`}
      className={`group relative block border border-border rounded-lg bg-card transition-colors duration-150 hover:border-subtle overflow-hidden ${
        featured ? "col-span-1 md:col-span-2" : ""
      }`}
      title={divisivePreview ?? undefined}
    >
      {/* Category-colored left border (#10) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l"
        style={{ backgroundColor: colors.border }}
      />

      <div className={`${featured ? "p-5" : "p-4"} pl-5`}>
        {/* Header: category pill + urgency pills + sparkline */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {topic.categoryName && topic.categorySlug && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  router.push(`/category/${topic.categorySlug}`);
                }}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 hover:opacity-80 transition-opacity border-none cursor-pointer"
                style={{ background: colors.bg, color: colors.text }}
              >
                {topic.categoryName}
              </button>
            )}
            {/* Urgency signals (#5) */}
            {isNew && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-green-500/15 text-green-400 border border-green-500/20">
                New
              </span>
            )}
            {isTrending && !isNew && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/20">
                Trending &uarr;
              </span>
            )}
            {topic.optionCount !== undefined && topic.optionCount > 0 && (
              <span className="text-[10px] text-subtle/70 font-mono">
                {topic.optionCount} options
              </span>
            )}
          </div>
          {sparklineData.length >= 2 && (
            <Sparkline
              data={sparklineData}
              color={colors.text}
              width={featured ? 80 : 60}
              height={featured ? 28 : 20}
              strokeWidth={1.5}
              className="shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
            />
          )}
        </div>

        {/* Title — #7 font-semibold for punch */}
        <h2
          className={`font-semibold text-foreground group-hover:text-foreground transition-colors duration-150 line-clamp-2 title-editorial ${
            featured ? "text-xl mb-4" : "text-[14px] mb-2.5"
          }`}
        >
          {topic.title}
        </h2>

        {/* Featured card shows description (#4) */}
        {featured && topic.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{topic.description}</p>
        )}

        {/* Top options with score bars */}
        {displayOptions.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {displayOptions.map((opt, idx) => {
              const score = opt.avgRating;
              const barWidth = Math.max(score * 10, 2);
              const barColor = getBarColor(score);

              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[11px] text-foreground/80 truncate flex-1 min-w-0">
                    {opt.name}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0 w-7 text-right tabular-nums">
                    {score > 0 ? score.toFixed(1) : "\u2014"}
                  </span>
                  <div className="w-16 h-[3px] bg-muted rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer: vote count + hover divisive preview (#6) */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-subtle font-mono">
            {formatVoteCount(topic.totalRatings)} votes
          </span>
          {divisivePreview && (
            <span className="text-[10px] text-subtle/70 hidden group-hover:inline transition-opacity duration-150">
              &middot; {divisivePreview}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
