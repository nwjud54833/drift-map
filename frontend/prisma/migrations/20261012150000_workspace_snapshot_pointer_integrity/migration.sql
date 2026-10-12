-- Keep the existing single-column SET NULL relations for snapshot deletion,
-- while requiring each non-null workspace pointer to reference a snapshot
-- owned by that same workspace.
ALTER TABLE "Workspace"
ADD CONSTRAINT "Workspace_id_baselineSnapshotId_fkey"
FOREIGN KEY ("id", "baselineSnapshotId")
REFERENCES "ContractSnapshot"("workspaceId", "id")
ON DELETE NO ACTION ON UPDATE NO ACTION,
ADD CONSTRAINT "Workspace_id_candidateSnapshotId_fkey"
FOREIGN KEY ("id", "candidateSnapshotId")
REFERENCES "ContractSnapshot"("workspaceId", "id")
ON DELETE NO ACTION ON UPDATE NO ACTION;
