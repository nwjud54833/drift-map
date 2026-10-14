import { MAX_IMPORT_BYTES, PayloadParseError, parsePayloadText } from "@/lib/contract/parse";
import { parseOpenApiText } from "@/lib/contract/openapi";
import type { ImportArtifact } from "@/lib/contract/types";

/**
 * Decides whether pasted or uploaded text is a payload-sample import or an
 * OpenAPI document, then runs the matching engine parser.
 *
 * This is presentation-layer routing only: it selects between the existing
 * `parsePayloadText` and `parseOpenApiText` entry points and does not change
 * either one's behaviour, inputs or outputs.
 */

function looksLikeOpenApi(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const value = JSON.parse(text) as Record<string, unknown>;
      return typeof value === "object" && value !== null && ("openapi" in value || "swagger" in value || "asyncapi" in value);
    } catch {
      return false;
    }
  }
  return /^\s*(?:openapi|swagger|asyncapi)\s*:/m.test(text);
}

export type ParseArtifactResult =
  | { ok: true; artifact: ImportArtifact; format: "samples" | "openapi" }
  | { ok: false; message: string; /** Engine message before any rewording. */ rawMessage?: string };

export interface ParseArtifactOptions {
  /** Treat the input as YAML regardless of content sniffing. */
  yaml?: boolean;
  /** Recorded on each produced sample. */
  source?: "paste" | "file" | "fixture" | "workspace-import";
  fileName?: string | null;
}

const MAX_IMPORT_LABEL = `${MAX_IMPORT_BYTES / 1024 / 1024} MB`;

export function parseImportArtifact(rawText: string, options: ParseArtifactOptions = {}): ParseArtifactResult {
  if (!rawText.trim()) return { ok: false, message: "Paste or choose a JSON payload to import." };
  if (new TextEncoder().encode(rawText).byteLength > MAX_IMPORT_BYTES) {
    return { ok: false, message: `This document is larger than the ${MAX_IMPORT_LABEL} import cap.` };
  }
  try {
    if (options.yaml || looksLikeOpenApi(rawText)) {
      return { ok: true, artifact: { format: "openapi", contract: parseOpenApiText(rawText) }, format: "openapi" };
    }
    return { ok: true, artifact: { format: "samples", samples: parsePayloadText(rawText, { source: options.source ?? "paste" }) }, format: "samples" };
  } catch (error) {
    if (error instanceof Error) {
      const raw = error.message;
      // The engine's payload messages are already plain language and already
      // name file-size limits; pass them through unchanged.
      if (error instanceof PayloadParseError) return { ok: false, message: raw, rawMessage: raw };
      return { ok: false, message: raw, rawMessage: raw };
    }
    return { ok: false, message: "Unable to read this document." };
  }
}
