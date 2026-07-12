/**
 * Worker startup — creates BullMQ Worker instances for each background job queue.
 * Connects to Redis and processes jobs concurrently.
 */
import env from "@next/env";
import path from "path";
import { fileURLToPath } from "url";

// Load env from monorepo root (single source of truth)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../..");
const isDev = process.env.NODE_ENV !== "production";
env.loadEnvConfig(monorepoRoot, isDev);

import { Worker } from "bullmq";
import { recalculateScore } from "./jobs/recalculate-score.js";
import { updateTrending } from "./jobs/update-trending.js";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6380";
const url = new URL(redisUrl);

const connection = {
  host: url.hostname,
  port: parseInt(url.port || "6380"),
};

/** Worker for recalculating option aggregate scores */
const scoreWorker = new Worker("recalculate-score", recalculateScore, {
  connection,
  concurrency: 5,
});

/** Worker for updating topic trending scores */
const trendingWorker = new Worker("update-trending", updateTrending, {
  connection,
  concurrency: 3,
});

// Graceful shutdown
const shutdown = async () => {
  console.log("Shutting down workers...");
  await scoreWorker.close();
  await trendingWorker.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("🔧 Workers started: recalculate-score, update-trending");
