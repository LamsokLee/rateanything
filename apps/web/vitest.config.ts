import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL: "postgres://rateanything:rateanything@localhost:5433/rateanything_test",
      NODE_ENV: "test",
      REDIS_URL: "",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/server/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["**/*.test.ts", "**/__tests__/**", "**/*.tsx", "src/test/**"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
  esbuild: {
    jsx: "automatic",
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
