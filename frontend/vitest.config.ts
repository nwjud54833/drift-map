import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The CLI reads `__DRIFTMAP_VERSION__` for its header. Inject the same value
 * `packages/driftmap/build.mjs` injects, from the one manifest both use, so a
 * test can assert the header without hard-coding a version that goes stale.
 */
const cliVersion: string = JSON.parse(
  readFileSync(path.resolve(__dirname, "..", "packages", "driftmap", "package.json"), "utf8"),
).version;

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
  define: { __DRIFTMAP_VERSION__: JSON.stringify(cliVersion) },
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    include: [integration ? "tests/integration/**/*.test.ts" : "tests/**/*.test.ts"],
    exclude: integration ? [] : ["tests/integration/**"],
  },
});
