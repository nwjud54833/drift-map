/**
 * Locating the offending line in a JSON payload.
 *
 * `JSON.parse` throws a `SyntaxError` whose message is engine-specific. V8 (the
 * engine in Chrome, Edge and Node) emits two distinct shapes:
 *
 *   A. Position reported:
 *      `Expected double-quoted property name in JSON at position 7 (line 1 column 8)`
 *      `Expected ',' or ']' after array element in JSON at position 4 (line 1 column 5)`
 *
 *   B. No position reported:
 *      `Unexpected token 'o', "{ "a": oops }" is not valid JSON`
 *      `Unexpected end of JSON input`
 *
 * Shape A is authoritative and is used directly. Shape B is deliberately **not**
 * mined for a location: the quoted text is a window around the problem whose
 * boundaries V8 truncates with `...` for long inputs, so its start is not the
 * error offset. (Measured: for input `{ "a": oops }` the snippet is the entire
 * input, whose start is offset 0, while the offending token is at offset 7.)
 * Guessing from it would highlight the wrong line, which is worse than
 * highlighting nothing, so shape B reports `line: null` and the editor says so.
 *
 * Nothing here re-implements or alters the engine's parsing, and the parser's
 * error text is passed through except for stripping the machine-readable tail so
 * the remainder reads as a sentence and the location is rendered separately.
 */

export interface JsonErrorLocation {
  /** 1-based line number, or null when the engine reported no position. */
  line: number | null;
  /** 1-based column number, or null when the engine reported no position. */
  column: number | null;
  /** Character offset the engine reported, when present. */
  position: number | null;
}

const POSITION_PATTERN = /\bposition\s+(\d+)\b/i;
const LINE_COLUMN_PATTERN = /\bline\s+(\d+)\s+column\s+(\d+)\b/i;
/**
 * Shape B suffix: `, "<window>" is not valid JSON`. V8 does not escape quotes
 * inside the window, so only the suffix start is matched — the comma.
 */
const SNIPPET_TAIL_ANCHOR_PATTERN = /,\s*"(?=[^]*is not valid JSON\s*$)/i;

/** Index of the `, "…" is not valid JSON` suffix, or -1 when absent. */
function snippetTailStart(engineMessage: string): number {
  return engineMessage.search(SNIPPET_TAIL_ANCHOR_PATTERN);
}

/** Converts a 0-based character offset into 1-based line and column numbers. */
export function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < clamped; index += 1) {
    if (text.charCodeAt(index) === 10) {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: clamped - lineStart + 1 };
}

export function locateJsonError(error: unknown, text: string): JsonErrorLocation {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  const positionMatch = POSITION_PATTERN.exec(message);
  if (positionMatch) {
    const position = Number.parseInt(positionMatch[1], 10);
    if (Number.isFinite(position)) {
      const { line, column } = offsetToLineColumn(text, position);
      return { line, column, position };
    }
  }

  const lineColumnMatch = LINE_COLUMN_PATTERN.exec(message);
  if (lineColumnMatch) {
    const line = Number.parseInt(lineColumnMatch[1], 10);
    const column = Number.parseInt(lineColumnMatch[2], 10);
    if (Number.isFinite(line)) return { line, column: Number.isFinite(column) ? column : null, position: null };
  }

  // Other engines (SpiderMonkey, JavaScriptCore) report `line N column M`
  // without a character offset. Nothing else is mined for a position.
  return { line: null, column: null, position: null };
}

export interface JsonSyntaxIssue {
  /** The engine's message with the machine-readable tail removed. */
  message: string;
  line: number | null;
  column: number | null;
}

/** Removes the `(line L column C)`, `at position N` and quoted-window tails. */
function humanize(engineMessage: string, text: string): string {
  const tailStart = snippetTailStart(engineMessage);
  const withoutTail = tailStart === -1 ? engineMessage : engineMessage.slice(0, tailStart);
  const stripped = withoutTail
    .replace(/\s*\(line\s+\d+\s+column\s+\d+\)\s*$/i, "")
    .replace(/\s*in JSON at position\s+\d+\s*$/i, "")
    .replace(/\s*at position\s+\d+\s*$/i, "")
    .replace(/[\s,]+$/, "")
    .trim();
  if (stripped.length >= 8) return stripped;
  const fallback = engineMessage.split(",")[0].replace(/\s+at position\s+\d+\s*$/i, "").trim();
  return fallback || (text.trim() ? "This is not valid JSON." : "");
}

/**
 * Validates JSON for the editor's inline feedback only. The import path still
 * goes through `lib/contract/parse.ts`, which owns the payload rules; this is
 * limited to syntax so the error text can be shown next to the caret without
 * duplicating the engine's rules.
 *
 * Returns null when the text parses.
 */
export function inspectJsonSyntax(text: string): JsonSyntaxIssue | null {
  if (!text.trim()) return null;
  try {
    JSON.parse(text);
    return null;
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Unable to parse JSON. Check the syntax and try again.";
    const { line, column } = locateJsonError(error, text);
    return { message: humanize(raw, text), line, column };
  }
}

/** Human-readable location string, or an honest fallback when none is known. */
export function describeJsonErrorLocation(location: { line: number | null; column: number | null }): string {
  if (location.line === null) return "This browser did not report an exact line";
  if (location.column === null) return `Line ${location.line}`;
  return `Line ${location.line}, column ${location.column}`;
}
