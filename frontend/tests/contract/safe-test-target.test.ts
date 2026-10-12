import { describe, expect, it } from "vitest";
import {
  compareDatabaseIdentityFields,
  resolveTestDatabaseUrl,
  TEST_DATABASE_CONFIRMATION,
} from "../integration/safe-test-target.mjs";

const confirmed = {
  TEST_DATABASE_URL: "postgresql://test-user:test-password@test-db.example.test/test_db?sslmode=require",
  DRIFTMAP_TEST_DATABASE_CONFIRMATION: TEST_DATABASE_CONFIRMATION,
};

describe("database integration target safety", () => {
  it("requires an explicit test URL and never falls back to the app URL", () => {
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: confirmed.TEST_DATABASE_URL }))
      .toThrow("DATABASE_URL is never used as a test fallback");
  });

  it("requires an explicit non-production isolation attestation", () => {
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: confirmed.TEST_DATABASE_URL }))
      .toThrow("independently verify");
  });

  it("rejects malformed and non-PostgreSQL URLs", () => {
    expect(() => resolveTestDatabaseUrl({ ...confirmed, TEST_DATABASE_URL: "not a url" }))
      .toThrow("valid PostgreSQL URL");
    expect(() => resolveTestDatabaseUrl({ ...confirmed, TEST_DATABASE_URL: "https://example.test/db" }))
      .toThrow("must identify a PostgreSQL host and database");
  });

  it("rejects a schema other than the isolated integration schema", () => {
    expect(() => resolveTestDatabaseUrl({
      ...confirmed,
      TEST_DATABASE_URL: `${confirmed.TEST_DATABASE_URL}&schema=public`,
    })).toThrow("may only target the driftmap_test schema");
  });

  it("rejects the same database identity as the application URL even when schemas differ", () => {
    const testUrl = "postgresql://test-user:test-password@db.example.test/app_db?schema=driftmap_test";
    const appUrl = "postgresql://app-user:other-password@DB.example.test:5432/app_db?schema=public";
    expect(() => resolveTestDatabaseUrl({
      ...confirmed,
      TEST_DATABASE_URL: testUrl,
      DATABASE_URL: appUrl,
    })).toThrow("same database as DATABASE_URL");
  });

  it("diagnoses only host, port, and database-name matches", () => {
    expect(compareDatabaseIdentityFields(
      "postgresql://test-user:test-password@db.example.test/app_db?sslmode=require&schema=driftmap_test",
      "postgres://app-user:other-password@DB.example.test:5432/app_db?sslmode=verify-full&schema=public",
    )).toEqual({ hostMatches: true, portMatches: true, databaseNameMatches: true });
  });

  it("recognizes Neon pooled and direct hostnames as the same endpoint", () => {
    expect(compareDatabaseIdentityFields(
      "postgresql://test-user:test-password@ep-sample-123-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
      "postgresql://app-user:other-password@ep-sample-123.us-east-2.aws.neon.tech:5432/neondb?sslmode=require",
    )).toEqual({ hostMatches: true, portMatches: true, databaseNameMatches: true });
  });

  it("does not match a different Neon endpoint or database name", () => {
    expect(compareDatabaseIdentityFields(
      "postgresql://test-user:test-password@ep-test-123-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
      "postgresql://app-user:other-password@ep-app-456.us-east-2.aws.neon.tech/appdb?sslmode=require",
    )).toEqual({ hostMatches: false, portMatches: true, databaseNameMatches: false });
  });

  it("preserves connection options and pins the target schema", () => {
    const result = new URL(resolveTestDatabaseUrl(confirmed));
    expect(result.searchParams.get("sslmode")).toBe("require");
    expect(result.searchParams.get("schema")).toBe("driftmap_test");
  });
});
