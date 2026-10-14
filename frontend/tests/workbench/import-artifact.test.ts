import { describe, expect, it } from "vitest";
import { parseImportArtifact } from "@/lib/workbench/import-artifact";
import { MAX_IMPORT_BYTES } from "@/lib/contract/parse";

const objectSample = JSON.stringify({ id: "ORD-1", status: "shipped" });
const arraySamples = JSON.stringify([{ id: "ORD-1" }, { id: "ORD-2" }]);
const openApiJson = JSON.stringify({
  openapi: "3.0.0",
  info: { title: "Orders", version: "1.0.0" },
  paths: { "/orders/{id}": { get: { operationId: "getOrder", responses: { "200": { description: "ok" } } } } },
});
const openApiYaml = `openapi: 3.0.0
info:
  title: Orders
  version: 1.0.0
paths:
  /orders:
    get:
      operationId: listOrders
      responses:
        '200':
          description: ok
`;

describe("parseImportArtifact", () => {
  it("parses a single JSON object into one sample", () => {
    const result = parseImportArtifact(objectSample);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("samples");
    if (result.artifact.format !== "samples") return;
    expect(result.artifact.samples).toHaveLength(1);
    expect(result.artifact.samples[0].value).toMatchObject({ id: "ORD-1" });
  });

  it("parses an array of objects into one sample per element", () => {
    const result = parseImportArtifact(arraySamples);
    expect(result.ok).toBe(true);
    if (!result.ok || result.artifact.format !== "samples") return;
    expect(result.artifact.samples).toHaveLength(2);
  });

  it("routes an OpenAPI JSON document to the specification parser", () => {
    const result = parseImportArtifact(openApiJson);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("openapi");
    if (result.artifact.format !== "openapi") return;
    expect(result.artifact.contract.operations).toHaveLength(1);
  });

  it("routes a YAML document to the specification parser even without a sniff match", () => {
    const result = parseImportArtifact(openApiYaml, { yaml: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("openapi");
  });

  it("detects an OpenAPI YAML document by its first key", () => {
    const result = parseImportArtifact(openApiYaml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("openapi");
  });

  it("rejects empty input with a plain-language message", () => {
    const result = parseImportArtifact("   \n ");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/paste or choose/i);
  });

  it("surfaces the engine's payload message for a non-object top level", () => {
    const result = parseImportArtifact("42");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/top-level value must be an object/i);
  });

  it("surfaces the engine's message for invalid JSON", () => {
    const result = parseImportArtifact("{ \"a\": }");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("rejects a document over the 2 MB import cap before parsing", () => {
    const oversized = `{ "pad": "${"x".repeat(MAX_IMPORT_BYTES + 16)}" }`;
    const result = parseImportArtifact(oversized);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/2 MB/);
  });

  it("does not duplicate the engine's own file-size wording", () => {
    // The engine also enforces the cap; whichever layer fires, the message is
    // the same string and mentions the limit once.
    const oversized = "x".repeat(MAX_IMPORT_BYTES + 1);
    const result = parseImportArtifact(oversized);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((result.message.match(/2 MB/g) ?? []).length).toBe(1);
  });
});
