import { describe, expect, it } from "vitest";
import {
  STRING_FORMAT_PATTERNS,
  detectStringFormat,
  stringFormatLabel,
  summarizeStringFormats,
} from "@/lib/contract/formats";

describe("string format patterns", () => {
  it("uses anchored explicit patterns for every supported format", () => {
    expect(STRING_FORMAT_PATTERNS.isoDate.source.startsWith("^")).toBe(true);
    expect(STRING_FORMAT_PATTERNS.dayFirstDate.source.startsWith("^")).toBe(true);
    expect(STRING_FORMAT_PATTERNS.email.source.startsWith("^")).toBe(true);
    expect(STRING_FORMAT_PATTERNS.uuid.source.startsWith("^")).toBe(true);
    expect(STRING_FORMAT_PATTERNS.jwt.source.startsWith("^")).toBe(true);
  });
});

describe("detectStringFormat", () => {
  it("detects an ISO date", () => {
    expect(detectStringFormat("2026-10-15")).toBe("iso-date");
    expect(detectStringFormat("2026-13-15")).toBeNull();
    expect(detectStringFormat("2026-10-32")).toBeNull();
  });

  it("detects a day-first date", () => {
    expect(detectStringFormat("15/10/2026")).toBe("day-first-date");
    expect(detectStringFormat("32/10/2026")).toBeNull();
    expect(detectStringFormat("15/13/2026")).toBeNull();
  });

  it("detects an email address", () => {
    expect(detectStringFormat("taylor@example.com")).toBe("email");
    expect(detectStringFormat("taylor@example")).toBeNull();
  });

  it("detects a UUID", () => {
    expect(detectStringFormat("123e4567-e89b-12d3-a456-426614174000")).toBe("uuid");
    expect(detectStringFormat("123e4567e89b12d3a456426614174000")).toBeNull();
  });

  it("detects a JWT-shaped token", () => {
    expect(detectStringFormat("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c")).toBe("jwt");
    // Short dotted version strings are not treated as tokens.
    expect(detectStringFormat("1.2.3")).toBeNull();
  });

  it("returns null for an ordinary string", () => {
    expect(detectStringFormat("shipped")).toBeNull();
    expect(detectStringFormat("")).toBeNull();
  });
});

describe("summarizeStringFormats", () => {
  it("returns the single format when all samples agree", () => {
    expect(summarizeStringFormats(new Set(["iso-date"]))).toEqual({ format: "iso-date", formats: ["iso-date"] });
    expect(summarizeStringFormats(new Set(["plain"]))).toEqual({ format: "plain", formats: ["plain"] });
  });

  it("reports mixed when samples disagree, including a plain sample", () => {
    expect(summarizeStringFormats(new Set(["iso-date", "day-first-date"]))).toEqual({
      format: "mixed",
      formats: ["iso-date", "day-first-date"],
    });
    expect(summarizeStringFormats(new Set(["email", "plain"]))).toEqual({
      format: "mixed",
      formats: ["email", "plain"],
    });
  });

  it("returns null when there is no string evidence", () => {
    expect(summarizeStringFormats(undefined)).toBeNull();
    expect(summarizeStringFormats(new Set())).toBeNull();
  });
});

describe("stringFormatLabel", () => {
  it("gives every format a human-readable name", () => {
    expect(stringFormatLabel("iso-date")).toBe("ISO date (YYYY-MM-DD)");
    expect(stringFormatLabel("day-first-date")).toBe("day-first date (DD/MM/YYYY)");
    expect(stringFormatLabel("email")).toBe("email");
    expect(stringFormatLabel("uuid")).toBe("UUID");
    expect(stringFormatLabel("jwt")).toBe("JWT");
    expect(stringFormatLabel("mixed")).toBe("mixed formats");
    expect(stringFormatLabel("plain")).toBe("plain string");
    expect(stringFormatLabel(null)).toBe("unknown format");
  });
});
