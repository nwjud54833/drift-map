import type { ContractSnapshot, StoredContract } from "@/lib/contract/types";

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Identity string shown in the contract view's fingerprint row.
 *
 * Sample-derived contracts already carry a stable `fingerprint` from the engine
 * and it is returned verbatim. OpenAPI contracts have no fingerprint field, so
 * one is derived here for display identity only — this is deliberately *not* in
 * `lib/contract/`, because the engine must not change.
 *
 * The derivation mirrors `inferContract`'s canonical form: per-path kinds and
 * requiredness, in the engine's sorted pointer order, hashed with the same
 * FNV-1a variant, and prefixed with `oas-` so the two origins are never confused.
 */
export function displayFingerprint(contract: StoredContract | null | undefined): string | null {
  if (!contract) return null;
  if ("inferenceVersion" in contract) return contract.fingerprint;

  let hash = FNV_OFFSET;
  for (const node of contract.nodes) {
    for (const line of [node.pointer, node.kinds.join("|"), String(node.required)]) {
      for (let index = 0; index < line.length; index += 1) {
        hash ^= line.charCodeAt(index);
        hash = Math.imul(hash, FNV_PRIME);
      }
    }
  }
  return `oas-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function snapshotFingerprint(snapshot: ContractSnapshot | null | undefined): string | null {
  return displayFingerprint(snapshot?.contract ?? null);
}

/** Paths on `other` that `side` does not have, so a tree can show them as removed. */
export function ghostPointers(other: ContractSnapshot | null, side: ContractSnapshot | null): string[] {
  if (!other) return [];
  const present = new Set((side?.contract.nodes ?? []).map((node) => node.pointer));
  return other.contract.nodes.map((node) => node.pointer).filter((pointer) => !present.has(pointer));
}
