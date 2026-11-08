import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Migrations run before the Vercel build publishes the app. Local builds remain
// offline so a developer's .env.local database is never migrated implicitly.
if (process.env.VERCEL !== "1") process.exit(0);

const configuredUrl = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();
if (!configuredUrl) throw new Error("Vercel builds require DATABASE_URL or DATABASE_URL_UNPOOLED to deploy Prisma migrations.");

let directUrl;
try {
  directUrl = new URL(configuredUrl);
} catch {
  throw new Error("The configured database URL is invalid.");
}
if (!["postgres:", "postgresql:"].includes(directUrl.protocol)) {
  throw new Error("Prisma migrations require a PostgreSQL URL.");
}
if (directUrl.hostname.includes("-pooler.")) {
  directUrl.hostname = directUrl.hostname.replace("-pooler.", ".");
}

const prismaCli = join(frontendRoot, "node_modules", "prisma", "build", "index.js");
if (!existsSync(prismaCli)) throw new Error("Prisma CLI is missing; install dependencies before building.");
const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  cwd: frontendRoot,
  env: { ...process.env, DATABASE_URL: directUrl.toString() },
  stdio: "inherit",
  windowsHide: true,
});
if (result.error) throw new Error("Unable to start Prisma migrations.");
if (result.status !== 0) process.exit(result.status ?? 1);
