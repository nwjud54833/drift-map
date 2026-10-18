import type { DetectedStringFormat, StringFormat, StringFormatEvidence } from "./types";

/**
 * Explicit, anchored patterns for the string formats DriftMap recognises in
 * sample values. These are heuristics, not JSON Schema declarations: they say
 * what the observed values look like, not what the API promises.
 */
export const STRING_FORMAT_PATTERNS = {
  isoDate: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  dayFirstDate: /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/,
  email: /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  // Three base64url-shaped segments. The two-character minimum avoids treating
  // short dotted version strings such as `1.2.3` as tokens.
  jwt: /^[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}$/,
} as const;

const FORMAT_ORDER: readonly StringFormat[] = ["iso-date", "day-first-date", "email", "uuid", "jwt"];

const FORMAT_LABELS: Record<DetectedStringFormat, string> = {
  "iso-date": "ISO date (YYYY-MM-DD)",
  "day-first-date": "day-first date (DD/MM/YYYY)",
  email: "email",
  uuid: "UUID",
  jwt: "JWT",
  mixed: "mixed formats",
  plain: "plain string",
};

export function stringFormatLabel(format: DetectedStringFormat | null | undefined): string {
  return format ? FORMAT_LABELS[format] : "unknown format";
}

export function detectStringFormat(value: string): StringFormat | null {
  const candidate = value.trim();
  if (STRING_FORMAT_PATTERNS.isoDate.test(candidate)) return "iso-date";
  if (STRING_FORMAT_PATTERNS.dayFirstDate.test(candidate)) return "day-first-date";
  if (STRING_FORMAT_PATTERNS.email.test(candidate)) return "email";
  if (STRING_FORMAT_PATTERNS.uuid.test(candidate)) return "uuid";
  if (STRING_FORMAT_PATTERNS.jwt.test(candidate)) return "jwt";
  return null;
}

export interface StringFormatSummary {
  format: DetectedStringFormat;
  formats: StringFormatEvidence[];
}

/**
 * Collapses all observed string formats for one node. Any disagreement,
 * including a mix of a recognised format and a plain string, is reported as
 * `mixed` rather than choosing the first or most common value.
 */
export function summarizeStringFormats(
  formats: ReadonlySet<StringFormatEvidence> | undefined,
): StringFormatSummary | null {
  if (!formats || formats.size === 0) return null;
  const present: StringFormatEvidence[] = FORMAT_ORDER.filter((format) => formats.has(format));
  if (formats.has("plain")) present.push("plain");
  if (present.length === 1) return { format: present[0] === "plain" ? "plain" : present[0], formats: present };
  return { format: "mixed", formats: present };
}
