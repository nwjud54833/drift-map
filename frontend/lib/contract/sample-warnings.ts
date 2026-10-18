import type { ContractSnapshot } from "./types";

/**
 * A sample count is "significantly different" when the larger side has at
 * least this many times the samples of the smaller side. One sample on either
 * side is always warned about separately.
 */
export const SAMPLE_COUNT_DISPARITY_FACTOR = 4;

export type SampleWarningCode = "single-sample" | "sample-count-disparity";

export interface SampleWarning {
  code: SampleWarningCode;
  message: string;
  baselineSamples: number;
  candidateSamples: number;
}

const REQUIREDNESS_CAVEAT = "Requiredness is based on the samples provided and may not reflect the real API.";

export function sampleWarningsForCounts(baselineSamples: number, candidateSamples: number): SampleWarning[] {
  const baseline = Math.max(0, Math.floor(baselineSamples));
  const candidate = Math.max(0, Math.floor(candidateSamples));
  // Zero samples means the side is an OpenAPI document or has no payload
  // evidence; sample-count warnings do not apply to it.
  if (baseline === 0 || candidate === 0) return [];

  const warnings: SampleWarning[] = [];
  if (baseline === 1 || candidate === 1) {
    warnings.push({
      code: "single-sample",
      message: `At least one side has only one sample. ${REQUIREDNESS_CAVEAT}`,
      baselineSamples: baseline,
      candidateSamples: candidate,
    });
  }

  const ratio = Math.max(baseline, candidate) / Math.min(baseline, candidate);
  if (ratio >= SAMPLE_COUNT_DISPARITY_FACTOR) {
    warnings.push({
      code: "sample-count-disparity",
      message: `The sample counts differ significantly (${baseline} baseline vs ${candidate} candidate; ${SAMPLE_COUNT_DISPARITY_FACTOR}× or more). ${REQUIREDNESS_CAVEAT}`,
      baselineSamples: baseline,
      candidateSamples: candidate,
    });
  }

  return warnings;
}

function sampleCount(snapshot: ContractSnapshot | null): number | null {
  if (!snapshot) return null;
  if ("kind" in snapshot.contract && snapshot.contract.kind === "openapi") return null;
  return snapshot.samples.length;
}

export function sampleWarningsForSnapshots(
  baseline: ContractSnapshot | null,
  candidate: ContractSnapshot | null,
): SampleWarning[] {
  const baselineSamples = sampleCount(baseline);
  const candidateSamples = sampleCount(candidate);
  if (baselineSamples === null || candidateSamples === null) return [];
  return sampleWarningsForCounts(baselineSamples, candidateSamples);
}
