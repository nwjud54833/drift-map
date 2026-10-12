import { resolveTestDatabaseUrl } from "./integration/safe-test-target.mjs";

/**
 * Validates the explicit test target only for database integration tests.
 * The default hermetic suite does not inspect local environment files.
 */
if (process.env.RUN_DB_TESTS === "1") {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("RUN_DB_TESTS=1 requires TEST_DATABASE_URL from the shell; .env.local is never a test URL fallback.");
  }
  const explicitTestUrl = process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile(".env.local");
    } catch {
      // The app URL is optional for comparison; the isolation attestation remains required.
    }
  }
  process.env.TEST_DATABASE_URL = explicitTestUrl;
  process.env.TEST_DATABASE_URL = resolveTestDatabaseUrl();
}

export {};
