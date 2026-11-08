export interface BaselinePromotionAudit {
  promotedAt: string;
  commitSha?: string;
  actor?: string;
  pathCount: number;
}

export function encodeBaselinePromotionNotes(audit: BaselinePromotionAudit): string {
  return [
    "Automatically promoted from a passing main branch build.",
    `driftmap.promotedAt=${audit.promotedAt}`,
    `driftmap.pathCount=${audit.pathCount}`,
    ...(audit.commitSha ? [`driftmap.commitSha=${audit.commitSha}`] : []),
    ...(audit.actor ? [`driftmap.actor=${audit.actor}`] : []),
  ].join("\n");
}

export function decodeBaselinePromotionNotes(notes: string | null | undefined): BaselinePromotionAudit | null {
  if (!notes) return null;
  try {
    const fields = new Map(notes.split(/\r?\n/).flatMap((line) => {
      const index = line.indexOf("=");
      return index > 0 && line.startsWith("driftmap.") ? [[line.slice(9, index), line.slice(index + 1)] as const] : [];
    }));
    const promotedAt = fields.get("promotedAt");
    const pathCount = Number(fields.get("pathCount"));
    const commitSha = fields.get("commitSha");
    const actor = fields.get("actor");
    if (!promotedAt || !Number.isFinite(Date.parse(promotedAt)) || !Number.isSafeInteger(pathCount) || pathCount < 0) return null;
    return {
      promotedAt: new Date(promotedAt).toISOString(),
      ...(commitSha && /^[0-9a-f]{7,64}$/i.test(commitSha) ? { commitSha } : {}),
      ...(actor && actor.length <= 100 ? { actor } : {}),
      pathCount,
    };
  } catch {
    return null;
  }
}

export function contractPathCount(contract: unknown): number {
  if (!contract || typeof contract !== "object") return 0;
  const nodes = (contract as { nodes?: unknown }).nodes;
  return Array.isArray(nodes) ? nodes.length : 0;
}
