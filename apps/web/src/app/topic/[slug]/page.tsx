/**
 * Topic detail page — Arena-first comparison experience.
 * Default mode is Arena (pairwise Elo voting). Users can switch to
 * traditional 1-10 Ratings via the mode toggle.
 * Retains: hero chart, ranked options table, per-option sparklines,
 * comment section, JSON-LD, OpenGraph metadata.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { safeAuth } from "@/lib/safe-auth";
import { getServerCaller } from "@/lib/server-trpc";
import { CHART_COLORS } from "@/lib/chart-colors";
import { RatingHistoryChart } from "@/components/RatingHistoryChart";
import { CommentSection } from "@/components/CommentSection";
import { ShareButton } from "@/components/ShareButton";
import { ModeOnly } from "@/components/ModeOnly";
import { TopicPageClient } from "@/components/TopicPageClient";

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
  const historyByOption: Record<string, { timestamp: string; avgScore: number; count: number }[]> = {};
  if (historyData) {
    historyData.options.forEach((opt, idx) => {
      optionColorMap[opt.optionId] = CHART_COLORS[idx % CHART_COLORS.length];
      historyByOption[opt.optionId] = opt.history;
    });
  }


  // --- JSON-LD Structured Data ---
  const totalRatings = topic.totalRatings ?? totalVotes;
  const weightedAvg =
    totalRatings > 0
      ? sortedOptions.reduce(
          (sum, o) => sum + (o.avgRating ?? 0) * (o.ratingCount ?? 0),
          0
        ) / totalRatings
      : 0;

  const jsonLd =
    totalRatings > 0
      ? {
          "@context": "https://schema.org",
          "@type": "Thing",
          name: topic.title,
          ...(topic.description ? { description: topic.description } : {}),
          url: `https://rating.fyi/topic/${topic.slug}`,
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Math.round(weightedAvg * 100) / 100,
            bestRating: 10,
            worstRating: 1,
            ratingCount: totalRatings,
          },
        }
      : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://rating.fyi" },
      ...(topic.category
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: topic.category.name,
              item: `https://rating.fyi/category/${topic.category.slug}`,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: topic.category ? 3 : 2,
        name: topic.title,
      },
    ],
  };

  return (
    <div className="space-y-6">

      {/* JSON-LD Structured Data */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

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
              <span className="text-subtle/30">&bull;</span>
              <span>{formatRelativeTime(topic.createdAt)}</span>
            </>
          )}
          <span className="text-subtle/30">&bull;</span>
          <ModeOnly mode="rate">
            <span className="font-mono">{totalVotes.toLocaleString()} votes</span>
            {/* Share button — uses native share or clipboard fallback */}
            <span className="text-subtle/30">&bull;</span>
          </ModeOnly>
          <ShareButton title={topic.title} />
        </div>
      </header>

      {/* ─── ARENA / RATINGS MODE SWITCH + CONTENT ─── */}
      <TopicPageClient
        topicId={topic.id}
        sortedOptions={sortedOptions.map((o) => ({
          id: o.id,
          name: o.name,
          avgRating: o.avgRating,
          ratingCount: o.ratingCount,
          userRating: o.userRating,
        }))}
        optionColorMap={optionColorMap}
        historyByOption={historyByOption}
        chartColors={CHART_COLORS}
      />

      {/* ─── SCORE HISTORY (collapsible) — only in Rating mode ─── */}
      {historyData && historyData.options.length > 0 && (
        <ModeOnly mode="rate">
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
        </ModeOnly>
      )}

      {/* ─── COMMENT SECTION ─── */}
      <CommentSection topicId={topic.id} />
    </div>
  );
}
