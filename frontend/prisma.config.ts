import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Generation and validation are offline operations. Migrations still need
  // an explicitly configured DATABASE_URL; this sentinel cannot reach a real DB.
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://invalid:invalid@127.0.0.1:1/invalid" },
});
