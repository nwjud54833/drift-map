import { describe, expect, it } from "vitest";
import { describeJsonErrorLocation, inspectJsonSyntax, locateJsonError, offsetToLineColumn } from "@/lib/workbench/json-error";

describe("offsetToLineColumn", () => {
  it("reports 1-based line and column for a single line", () => {
    expect(offsetToLineColumn("{ \"a\": 1 }", 0)).toEqual({ line: 1, column: 1 });
    expect(offsetToLineColumn("{ \"a\": 1 }", 5)).toEqual({ line: 1, column: 6 });
  });

  it("counts newlines and starts each line at column 1", () => {
    // Index map: 0 "{", 1 "\n", 2..10 line 2, 11 "\n", 12..20 line 3, 21 "}".
    const text = "{\n  \"a\": 1,\n  \"b\": 2\n}";
    expect(offsetToLineColumn(text, 2)).toEqual({ line: 2, column: 1 });
    expect(offsetToLineColumn(text, 10)).toEqual({ line: 2, column: 9 });
    expect(offsetToLineColumn(text, 11)).toEqual({ line: 2, column: 10 });
    expect(offsetToLineColumn(text, 12)).toEqual({ line: 3, column: 1 });
    expect(offsetToLineColumn(text, 14)).toEqual({ line: 3, column: 3 });
  });

  it("clamps out-of-range offsets instead of throwing", () => {
    expect(offsetToLineColumn("abc", 99).line).toBe(1);
    expect(offsetToLineColumn("abc", -5)).toEqual({ line: 1, column: 1 });
  });
});

describe("locateJsonError", () => {
  it("converts an engine-reported position into line and column", () => {
    const text = "{\n  \"a\": 1,\n  oops\n}";
    expect(locateJsonError(new SyntaxError("Expected ':' in JSON at position 14 (line 3 column 3)"), text))
      .toEqual({ line: 3, column: 3, position: 14 });
  });

  it("uses a line/column pair when the engine reports one without a position", () => {
    expect(locateJsonError(new SyntaxError("Expecting value: line 4 column 7 (char 20)"), "x"))
      .toEqual({ line: 4, column: 7, position: null });
  });

  it("does not invent a location from the quoted window in position-less messages", () => {
    // V8 quotes a window around the problem whose start is not the error
    // offset, so the only honest answer is "not reported".
    const text = '{ "a": oops }';
    expect(locateJsonError(new SyntaxError('Unexpected token \'o\', "{ "a": oops }" is not valid JSON'), text))
      .toEqual({ line: null, column: null, position: null });
    // Even when the quoted window happens to equal the whole input.
    expect(locateJsonError(new SyntaxError('Unexpected token \'}\', "{ "a": }" is not valid JSON'), '{ "a": }'))
      .toEqual({ line: null, column: null, position: null });
  });

  it("reports no location for messages without any position information", () => {
    expect(locateJsonError(new SyntaxError("Unexpected end of JSON input"), "{")).toEqual({ line: null, column: null, position: null });
    expect(locateJsonError("not an error object", "{")).toEqual({ line: null, column: null, position: null });
    expect(locateJsonError(undefined, "{")).toEqual({ line: null, column: null, position: null });
  });
});

describe("inspectJsonSyntax", () => {
  it("returns null for valid JSON", () => {
    expect(inspectJsonSyntax("{\"a\":[1,2,3]}")).toBeNull();
  });

  it("returns null for whitespace-only input so an empty editor is not an error", () => {
    expect(inspectJsonSyntax("")).toBeNull();
    expect(inspectJsonSyntax("   \n  ")).toBeNull();
  });

  it("reports a syntax problem with a non-empty message", () => {
    const issue = inspectJsonSyntax("{\n  \"a\": 1,\n  \"b\": ,\n}");
    expect(issue).not.toBeNull();
    expect(issue?.message.length).toBeGreaterThan(0);
  });

  it("reports line and column for the error shapes that carry a position", () => {
    // Trailing comma: V8 reports `... in JSON at position 7 (line 1 column 8)`.
    expect(inspectJsonSyntax("{\"a\":1,}")?.line).toBe(1);
    expect(inspectJsonSyntax("{\"a\":1,}")?.column).toBe(8);
    // Unterminated array: position 4, line 1 column 5.
    expect(inspectJsonSyntax("[1,2")).toEqual({ message: "Expected ',' or ']' after array element", line: 1, column: 5 });
  });

  it("locates an error on a later line", () => {
    const issue = inspectJsonSyntax('{\n  "a": 1,\n  "b": 2,\n}');
    expect(issue?.line).toBe(4);
  });

  it("honestly reports no line when the engine gave no position", () => {
    const issue = inspectJsonSyntax('{ "a": oops }');
    expect(issue).not.toBeNull();
    expect(issue?.line).toBeNull();
    expect(issue?.column).toBeNull();
  });

  it("strips the engine's machine-readable tail from the displayed message", () => {
    for (const source of ['{ "a": }', '{"a":1,}', "oops", "[1,2", '{\n  "a": 1,\n  "b": ,\n}']) {
      const issue = inspectJsonSyntax(source);
      expect(issue?.message).not.toMatch(/at position\s+\d+/i);
      expect(issue?.message).not.toMatch(/\(line\s+\d+\s+column\s+\d+\)/i);
      expect(issue?.message).not.toMatch(/is not valid JSON/i);
      // The raw input is never echoed back as part of the message.
      expect(issue?.message.length).toBeLessThan(120);
    }
  });

  it("keeps the human part of the message intact", () => {
    expect(inspectJsonSyntax("{\"a\":1,}")?.message).toMatch(/double-quoted property name/i);
    expect(inspectJsonSyntax("[1,2")?.message).toMatch(/array element/i);
  });
});

describe("describeJsonErrorLocation", () => {
  it("labels line and column when both are known", () => {
    expect(describeJsonErrorLocation({ line: 3, column: 5 })).toBe("Line 3, column 5");
  });

  it("degrades gracefully when no position is known", () => {
    expect(describeJsonErrorLocation({ line: null, column: null })).toBe("This browser did not report an exact line");
    expect(describeJsonErrorLocation({ line: 2, column: null })).toBe("Line 2");
  });
});
