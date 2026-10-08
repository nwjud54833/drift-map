-- CreateEnum
CREATE TYPE "ContractDirection" AS ENUM ('response', 'request', 'event');

-- CreateEnum
CREATE TYPE "SnapshotSource" AS ENUM ('paste', 'file', 'fixture', 'workspace_import');

-- CreateEnum
CREATE TYPE "ChangeKind" AS ENUM ('field_added', 'field_removed', 'type_changed', 'became_required', 'became_optional');

-- CreateEnum
CREATE TYPE "ChangeSeverity" AS ENUM ('breaking', 'warning', 'safe', 'info');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "direction" "ContractDirection" NOT NULL,
    "baselineSnapshotId" UUID,
    "candidateSnapshotId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractSnapshot" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "sourceFileName" TEXT,
    "contract" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayloadSample" (
    "id" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "source" "SnapshotSource" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "PayloadSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractDiff" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "baselineSnapshotId" UUID NOT NULL,
    "candidateSnapshotId" UUID NOT NULL,
    "direction" "ContractDirection" NOT NULL,
    "summary" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractDiff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractChange" (
    "id" TEXT NOT NULL,
    "diffId" UUID NOT NULL,
    "pointer" TEXT NOT NULL,
    "kind" "ChangeKind" NOT NULL,
    "severity" "ChangeSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "beforeNode" JSONB,
    "afterNode" JSONB,

    CONSTRAINT "ContractChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workspace_updatedAt_idx" ON "Workspace"("updatedAt");

-- CreateIndex
CREATE INDEX "Workspace_createdAt_idx" ON "Workspace"("createdAt");

-- CreateIndex
CREATE INDEX "ContractSnapshot_workspaceId_createdAt_idx" ON "ContractSnapshot"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ContractSnapshot_versionLabel_idx" ON "ContractSnapshot"("versionLabel");

-- CreateIndex
CREATE INDEX "PayloadSample_snapshotId_capturedAt_idx" ON "PayloadSample"("snapshotId", "capturedAt");

-- CreateIndex
CREATE INDEX "ContractDiff_workspaceId_generatedAt_idx" ON "ContractDiff"("workspaceId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractDiff_baselineSnapshotId_candidateSnapshotId_directi_key" ON "ContractDiff"("baselineSnapshotId", "candidateSnapshotId", "direction");

-- CreateIndex
CREATE INDEX "ContractChange_diffId_severity_idx" ON "ContractChange"("diffId", "severity");

-- CreateIndex
CREATE INDEX "ContractChange_pointer_idx" ON "ContractChange"("pointer");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_baselineSnapshotId_fkey" FOREIGN KEY ("baselineSnapshotId") REFERENCES "ContractSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_candidateSnapshotId_fkey" FOREIGN KEY ("candidateSnapshotId") REFERENCES "ContractSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractSnapshot" ADD CONSTRAINT "ContractSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayloadSample" ADD CONSTRAINT "PayloadSample_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ContractSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDiff" ADD CONSTRAINT "ContractDiff_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDiff" ADD CONSTRAINT "ContractDiff_baselineSnapshotId_fkey" FOREIGN KEY ("baselineSnapshotId") REFERENCES "ContractSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDiff" ADD CONSTRAINT "ContractDiff_candidateSnapshotId_fkey" FOREIGN KEY ("candidateSnapshotId") REFERENCES "ContractSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractChange" ADD CONSTRAINT "ContractChange_diffId_fkey" FOREIGN KEY ("diffId") REFERENCES "ContractDiff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
