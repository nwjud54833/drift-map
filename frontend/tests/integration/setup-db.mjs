import { execSync } from "node:child_process";
import { resolveTestDatabaseUrl } from "./safe-test-target.mjs";

/**
 * Applies the checked-in migrations to a dedicated test schema.
 * TEST_DATABASE_URL must be configured out-of-band. The app DATABASE_URL may
 * be read from .env.local only for same-database rejection; it is never used
 * as the test target and no connection string is printed.
 */
if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must be configured in the shell; DATABASE_URL is never used as a test fallback.");
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

const testUrl = resolveTestDatabaseUrl();

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testUrl },
});
