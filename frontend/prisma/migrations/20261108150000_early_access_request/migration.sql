CREATE TABLE "EarlyAccessRequest" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "githubOrg" VARCHAR(39),
    "repositoryCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarlyAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EarlyAccessRequest_email_key" ON "EarlyAccessRequest"("email");
CREATE INDEX "EarlyAccessRequest_createdAt_idx" ON "EarlyAccessRequest"("createdAt");
