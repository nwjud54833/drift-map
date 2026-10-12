import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Two suites share this config:
 *
 * - Default `npm test` is hermetic (unit + route tests, no database).
 * - `RUN_DB_TESTS=1 npx vitest run tests/integration/db.test.ts` runs the
 *   real-database integration tests against an isolated Postgres schema.
 */
const integration = process.env.RUN_DB_TESTS === "1";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    include: [integration ? "tests/integration/**/*.test.ts" : "tests/**/*.test.ts"],
    exclude: integration ? [] : ["tests/integration/**"],
  },
});
