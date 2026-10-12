export declare const TEST_SCHEMA: string;
export declare const TEST_DATABASE_CONFIRMATION: string;
export declare function compareDatabaseIdentityFields(
  testUrl: string,
  appUrl: string,
): { hostMatches: boolean; portMatches: boolean; databaseNameMatches: boolean };
export declare function resolveTestDatabaseUrl(env?: Record<string, string | undefined>): string;
