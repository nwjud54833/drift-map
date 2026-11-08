import { inferContract } from "@/lib/contract/infer";
import type { ContractDirection, ContractSnapshot, Workspace } from "@/lib/contract/types";
import { parseImportArtifact } from "@/lib/workbench/import-artifact";

const MAX_REVIEW_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_REVIEW_STATE_BYTES = 4 * 1024 * 1024;
export const MAX_REVIEW_LINK_LENGTH = 7_000;

export interface ReviewPayload {
  version: 1;
  workspace: { id: string; name: string; direction: ContractDirection };
  baseline: { id: string; versionLabel: string; document: unknown };
  candidate: { id: string; versionLabel: string; document: unknown };
}

export interface ReviewPreview {
  workspace: Workspace;
  baseline: ContractSnapshot;
  candidate: ContractSnapshot;
}

function snapshotDocument(snapshot: ContractSnapshot): unknown {
  if ("kind" in snapshot.contract && snapshot.contract.kind === "openapi") return snapshot.contract.document;
  const values = snapshot.samples.map((sample) => sample.value);
  return values.length === 1 ? values[0] : values;
}

export function buildReviewPayload(workspace: Workspace, baseline: ContractSnapshot, candidate: ContractSnapshot): ReviewPayload {
  return {
    version: 1,
    workspace: { id: workspace.id, name: workspace.name, direction: workspace.direction },
    baseline: { id: baseline.id, versionLabel: baseline.versionLabel, document: snapshotDocument(baseline) },
    candidate: { id: candidate.id, versionLabel: candidate.versionLabel, document: snapshotDocument(candidate) },
  };
}

function makeSnapshot(input: ReviewPayload["baseline"], workspaceId: string): ContractSnapshot | null {
  if (!input || typeof input.id !== "string" || typeof input.versionLabel !== "string" || input.versionLabel.length > 120) return null;
  let raw: string;
  try { raw = JSON.stringify(input.document); } catch { return null; }
  if (typeof raw !== "string" || new TextEncoder().encode(raw).byteLength > MAX_REVIEW_DOCUMENT_BYTES) return null;
  const parsed = parseImportArtifact(raw, { source: "workspace-import", fileName: input.versionLabel });
  if (!parsed.ok) return null;
  const samples = parsed.artifact.format === "samples" ? parsed.artifact.samples : [];
  const contract = parsed.artifact.format === "openapi" ? parsed.artifact.contract : inferContract(samples);
  return {
    id: input.id.slice(0, 100), workspaceId, versionLabel: input.versionLabel,
    notes: "Read-only shared review", sourceFileName: null, samples, contract,
    createdAt: new Date(0).toISOString(),
  };
}

export function parseReviewPayload(value: unknown): ReviewPreview | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<ReviewPayload>;
  const workspace = payload.workspace;
  if (payload.version !== 1 || !workspace || typeof workspace.id !== "string" || typeof workspace.name !== "string"
    || workspace.name.length > 120 || !["response", "request", "event"].includes(workspace.direction)) return null;
  const id = `review-${workspace.id.slice(0, 80)}`;
  const baseline = makeSnapshot(payload.baseline as ReviewPayload["baseline"], id);
  const candidate = makeSnapshot(payload.candidate as ReviewPayload["candidate"], id);
  if (!baseline || !candidate) return null;
  const now = new Date(0).toISOString();
  return {
    workspace: {
      id, name: workspace.name, direction: workspace.direction as ContractDirection,
      baselineSnapshotId: baseline.id, candidateSnapshotId: candidate.id,
      createdAt: now, updatedAt: now,
    },
    baseline,
    candidate,
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid shared review link.");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function streamBytes(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) throw new Error("Shared review data exceeds the size limit.");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

export async function encodeReviewState(payload: ReviewPayload): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  if (raw.byteLength > MAX_REVIEW_STATE_BYTES) throw new Error("Review data exceeds the 4 MiB sharing limit.");
  if (typeof CompressionStream === "undefined") throw new Error("Compressed review links are not supported in this browser.");
  const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip"));
  const compressed = await streamBytes(stream, MAX_REVIEW_STATE_BYTES);
  const encoded = `z.${toBase64Url(compressed)}`;
  if (encoded.length > MAX_REVIEW_LINK_LENGTH) throw new Error("This local review is too large to fit in a shareable link. Try a synced workspace for a signed read-only link.");
  return encoded;
}

export async function decodeReviewState(encoded: string): Promise<ReviewPreview | null> {
  if (!encoded.startsWith("z.") || encoded.length > MAX_REVIEW_LINK_LENGTH) return null;
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const compressed = fromBase64Url(encoded.slice(2));
    const compressedCopy = new Uint8Array(compressed.byteLength);
    compressedCopy.set(compressed);
    const stream = new Blob([compressedCopy]).stream().pipeThrough(new DecompressionStream("gzip"));
    const bytes = await streamBytes(stream, MAX_REVIEW_STATE_BYTES);
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return parseReviewPayload(payload);
  } catch {
    return null;
  }
}
