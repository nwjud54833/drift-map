/**
 * ANSI color roles for the CLI's text presentation.
 *
 * Every role is one standard 16-color SGR sequence so the terminal theme owns
 * the exact palette. The CLI never emits truecolor RGB, backgrounds, italics,
 * or underlines.
 */
export const ANSI_CODES = {
  verdictFail: "\u001b[1;91m",
  verdictPass: "\u001b[1;92m",
  breaking: "\u001b[91m",
  warning: "\u001b[93m",
  safe: "\u001b[32m",
  info: "\u001b[96m",
  pointer: "\u001b[1;97m",
  dim: "\u001b[2m",
} as const;

export type ColorRole = keyof typeof ANSI_CODES;
export type Paint = (role: ColorRole, text: string) => string;

const RESET = "\u001b[0m";

/** Returns a role-aware painter; when disabled every role is a no-op. */
export function createPaint(enabled: boolean): Paint {
  if (!enabled) return (_role, text) => text;
  return (role, text) => `${ANSI_CODES[role]}${text}${RESET}`;
}
