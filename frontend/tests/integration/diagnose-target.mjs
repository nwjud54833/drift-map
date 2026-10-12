import { compareDatabaseIdentityFields } from "./safe-test-target.mjs";

// This is an offline diagnostic. It requires the test URL from the shell and
// never prints URL components, credentials, query parameters, or secrets.
if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Set TEST_DATABASE_URL explicitly in this shell before running the diagnostic.");
}
const explicitTestUrl = process.env.TEST_DATABASE_URL;
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Report a sanitized configuration error below when no app URL is available.
  }
}
process.env.TEST_DATABASE_URL = explicitTestUrl;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is unavailable for a local identity comparison.");
}

console.log(JSON.stringify(
  compareDatabaseIdentityFields(process.env.TEST_DATABASE_URL, process.env.DATABASE_URL),
));
