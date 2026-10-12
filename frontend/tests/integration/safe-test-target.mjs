export const TEST_SCHEMA = "driftmap_test";
export const TEST_DATABASE_CONFIRMATION = "I_VERIFIED_EMPTY_NON_PRODUCTION";

function parseDatabaseIdentity(rawUrl, variableName) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL URL.`);
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname === "/") {
    throw new Error(`${variableName} must identify a PostgreSQL host and database.`);
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch {
    throw new Error(`${variableName} contains an invalid database name.`);
  }

  return {
    // Neon uses the same endpoint with and without the -pooler hostname suffix.
    host: url.hostname.toLowerCase().replace(/-pooler(?=\.|$)/, ""),
    port: url.port || "5432",
    databaseName,
  };
}

/** Reports only whether non-secret PostgreSQL identity fields match. */
export function compareDatabaseIdentityFields(testUrl, appUrl) {
  const test = parseDatabaseIdentity(testUrl, "TEST_DATABASE_URL");
  const app = parseDatabaseIdentity(appUrl, "DATABASE_URL");
  return {
    hostMatches: test.host === app.host,
    portMatches: test.port === app.port,
    databaseNameMatches: test.databaseName === app.databaseName,
  };
}

/**
 * Resolve an explicitly selected test database and apply the suite's schema.
 * The confirmation is an operator attestation; a URL alone cannot establish
 * database emptiness or Neon branch ancestry. The app database identity is
 * also rejected when it is available in the environment.
 */
export function resolveTestDatabaseUrl(env = process.env) {
  const rawTestUrl = env.TEST_DATABASE_URL;
  if (!rawTestUrl) {
    throw new Error("TEST_DATABASE_URL is required; DATABASE_URL is never used as a test fallback.");
  }
  if (env.DRIFTMAP_TEST_DATABASE_CONFIRMATION !== TEST_DATABASE_CONFIRMATION) {
    throw new Error(
      `Before database access, independently verify in your provider console that TEST_DATABASE_URL targets an empty, dedicated, non-production database with no copied customer data; then set DRIFTMAP_TEST_DATABASE_CONFIRMATION=${TEST_DATABASE_CONFIRMATION}.`,
    );
  }

  parseDatabaseIdentity(rawTestUrl, "TEST_DATABASE_URL");
  const testUrl = new URL(rawTestUrl);

  const requestedSchema = testUrl.searchParams.get("schema");
  if (requestedSchema && requestedSchema !== TEST_SCHEMA) {
    throw new Error(`TEST_DATABASE_URL may only target the ${TEST_SCHEMA} schema.`);
  }

  if (env.DATABASE_URL) {
    const matches = compareDatabaseIdentityFields(rawTestUrl, env.DATABASE_URL);
    if (matches.hostMatches && matches.portMatches && matches.databaseNameMatches) {
      throw new Error("TEST_DATABASE_URL points to the same database as DATABASE_URL; refusing database access.");
    }
  }

  testUrl.searchParams.set("schema", TEST_SCHEMA);
  return testUrl.toString();
}
