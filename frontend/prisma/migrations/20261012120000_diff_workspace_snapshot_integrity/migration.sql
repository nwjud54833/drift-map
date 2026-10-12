-- Ensure a persisted diff can only reference snapshots belonging to its workspace.
CREATE UNIQUE INDEX "ContractSnapshot_workspaceId_id_key"
ON "ContractSnapshot"("workspaceId", "id");

ALTER TABLE "ContractDiff"
DROP CONSTRAINT "ContractDiff_baselineSnapshotId_fkey",
DROP CONSTRAINT "ContractDiff_candidateSnapshotId_fkey";

ALTER TABLE "ContractDiff"
ADD CONSTRAINT "ContractDiff_workspaceId_baselineSnapshotId_fkey"
FOREIGN KEY ("workspaceId", "baselineSnapshotId")
REFERENCES "ContractSnapshot"("workspaceId", "id")
ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "ContractDiff_workspaceId_candidateSnapshotId_fkey"
FOREIGN KEY ("workspaceId", "candidateSnapshotId")
REFERENCES "ContractSnapshot"("workspaceId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;
