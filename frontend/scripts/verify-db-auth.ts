import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";
import { resolveTestDatabaseUrl } from "../tests/integration/safe-test-target.mjs";

loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("Set TEST_DATABASE_URL to a dedicated, empty, non-production database.");
  }

  const testUrl = resolveTestDatabaseUrl();
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: testUrl }) });
  const adapter = PrismaAdapter(prisma);
  const id = randomUUID();
  const userId = `verify-${id}`;
  const sessionToken = `verify-${id}`;
  const email = `verify-${id}@example.invalid`;
  const payload = "x".repeat(1024 * 1024);

  try {
    const user = await adapter.createUser!({
      id: userId, email, name: "DriftMap DB verification", emailVerified: null, image: null,
    });
    const session = await adapter.createSession!({
      userId: user.id, sessionToken, expires: new Date(Date.now() + 60_000),
    });
    if ((await adapter.getSessionAndUser!(sessionToken))?.user.id !== user.id) {
      throw new Error("Database session round-trip failed.");
    }

    const workspace = await prisma.workspace.create({
      data: { userId, name: "Initial verification workspace", direction: "response" },
    });
    const snapshot = await prisma.contractSnapshot.create({
      data: {
        workspaceId: workspace.id,
        versionLabel: "large-json-round-trip",
        contract: { probe: payload },
      },
    });
    await prisma.workspace.update({ where: { id: workspace.id }, data: { name: "Updated verification workspace" } });

    const loaded = await prisma.workspace.findFirst({
      where: { id: workspace.id, userId: user.id },
      include: { snapshots: true, user: { include: { sessions: true } } },
    });
    const storedPayload = (loaded?.snapshots[0]?.contract as { probe?: unknown } | undefined)?.probe;
    if (loaded?.name !== "Updated verification workspace" || loaded.snapshots.length !== 1
      || loaded.snapshots[0]?.id !== snapshot.id || storedPayload !== payload
      || loaded.user.sessions[0]?.sessionToken !== session.sessionToken) {
      throw new Error("Workspace, snapshot, or session round-trip failed.");
    }

    process.stdout.write("Database auth/workspace verification passed (user, session, 1 MiB JSON snapshot, update, query).\n");
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Database verification failed."}\n`);
  process.exitCode = 1;
});
