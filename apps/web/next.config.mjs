/**
 * Next.js configuration — transpiles the internal db package
 * so its TypeScript source can be used directly without a build step.
 */
import env from "@next/env";
import path from "path";
import { fileURLToPath } from "url";

// Load env from monorepo root (single source of truth)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../..");
const isDev = process.env.NODE_ENV !== "production";
env.loadEnvConfig(monorepoRoot, isDev);

/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@rateanything/db"],
  experimental: {
    typedRoutes: true,
  },
  webpack: (config) => {
    // Resolve .js imports to .ts files in transpiled packages (ESM convention)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
