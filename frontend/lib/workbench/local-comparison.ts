import { compareContracts } from "@/lib/contract/compare";
import type { ContractDirection, StoredContract } from "@/lib/contract/types";

/** Local comparisons are pure browser work and never call the cloud API. */
export function compareLocalContracts(
  baseline: StoredContract,
  candidate: StoredContract,
  direction: ContractDirection,
) {
  return compareContracts(baseline, candidate, direction);
}
