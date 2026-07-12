/**
 * Dynamic OpenGraph share-image for topic pages.
 * Uses Next.js built-in ImageResponse (next/og) to render a branded card
 * showing topic title, top-rated option, average rating, and total votes.
 */
import { ImageResponse } from "next/og";
import { getServerCaller } from "@/lib/server-trpc";

export const runtime = "nodejs";

// Cache the generated image for 1 hour to avoid re-running the DB query
// on every crawler/social-media hit.
export const revalidate = 3600;

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } }) {
  let title = "RateAnything";
  let topOption: string | null = null;
  let topScore: number | null = null;
  let totalVotes = 0;

  try {
    const caller = await getServerCaller(undefined);
    const topic = await caller.topics.getBySlug({ slug: params.slug });
    title = topic.title;

    // Sort options by avgRating DESC to find top-rated
    const sorted = [...topic.options].sort(
      (a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0)
    );

    totalVotes = sorted.reduce((sum, o) => sum + (o.ratingCount ?? 0), 0);

    if (sorted.length > 0 && (sorted[0].ratingCount ?? 0) > 0) {
      topOption = sorted[0].name;
      topScore = sorted[0].avgRating ?? 0;
    }
  } catch {
    // Topic not found — render generic branded fallback
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #18181b 0%, #1e1b4b 50%, #18181b 100%)",
          padding: "60px",
        }}
      >
        {/* Branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "40px",
            fontSize: "28px",
            fontWeight: 700,
            color: "#a78bfa",
            letterSpacing: "-0.5px",
          }}
        >
          RateAnything
        </div>

        {/* Topic title */}
        <div
          style={{
            display: "flex",
            textAlign: "center",
            fontSize: title.length > 60 ? "36px" : "48px",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.2,
            maxWidth: "900px",
            marginBottom: "36px",
          }}
        >
          {title}
        </div>

        {/* Stats row */}
        {(topOption || totalVotes > 0) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "32px",
              marginTop: "8px",
            }}
          >
            {topOption && topScore !== null && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "16px 28px",
                  borderRadius: "12px",
                  background: "rgba(167, 139, 250, 0.15)",
                  border: "1px solid rgba(167, 139, 250, 0.3)",
                }}
              >
                <div style={{ display: "flex", fontSize: "16px", color: "#a1a1aa", marginBottom: "4px" }}>
                  Top Rated
                </div>
                <div style={{ display: "flex", fontSize: "24px", fontWeight: 600, color: "#ffffff" }}>
                  {topOption.length > 30 ? topOption.slice(0, 27) + "..." : topOption}
                </div>
                <div style={{ display: "flex", fontSize: "20px", fontWeight: 700, color: "#a78bfa", marginTop: "4px" }}>
                  {topScore.toFixed(1)} / 10
                </div>
              </div>
            )}
            {totalVotes > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "16px 28px",
                  borderRadius: "12px",
                  background: "rgba(63, 63, 70, 0.5)",
                  border: "1px solid rgba(113, 113, 122, 0.3)",
                }}
              >
                <div style={{ display: "flex", fontSize: "16px", color: "#a1a1aa", marginBottom: "4px" }}>
                  Total Votes
                </div>
                <div style={{ display: "flex", fontSize: "28px", fontWeight: 700, color: "#ffffff" }}>
                  {totalVotes.toLocaleString()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
