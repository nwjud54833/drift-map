import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import jsonFixture from "@/fixtures/openapi-v3.json";
import { compareOpenApiContracts, OpenApiParseError, parseOpenApiText } from "@/lib/contract/openapi";

const documentWith = (paths: Record<string, unknown>) => ({ openapi: "3.0.3", info: { title: "Test API", version: "1" }, paths });
const simpleOperation = (responses: Record<string, unknown>) => ({ get: { responses } });

describe("OpenAPI 3.0 import", () => {
  it("normalizes equivalent JSON and YAML into the same contract", () => {
    const json = parseOpenApiText(JSON.stringify(jsonFixture));
    const yaml = parseOpenApiText(readFileSync("fixtures/openapi-v3.yaml", "utf8"));
    expect(yaml).toEqual(json);
    expect(json.operations).toHaveLength(1);
    expect(json.operations[0].key).toBe("/orders/{orderId}#get");
    expect(json.operations[0].parameters).toHaveLength(1);
    const response = json.operations[0].responses["200"] as { content: Record<string, { schema: { type: string; properties: { state: { enum: string[] } } } }> };
    expect(response.content["application/json"].schema).toMatchObject({ type: "object", properties: { state: { type: "string", enum: ["open", "closed"] } } });
  });

  it("reports malformed and unsupported documents distinctly", () => {
    expect(() => parseOpenApiText("{oops")).toThrow(/parse the specification/);
    expect(() => parseOpenApiText(JSON.stringify({ ...documentWith({}), openapi: "3.1.0" }))).toThrow(/3.1 is not supported/);
    expect(() => parseOpenApiText(JSON.stringify({ swagger: "2.0" }))).toThrow(/Swagger 2.0 is not supported/);
    expect(() => parseOpenApiText(JSON.stringify({ asyncapi: "3.0.0", info: { title: "x", version: "1" } }))).toThrow(/AsyncAPI documents are not supported/);
    expect(() => parseOpenApiText(JSON.stringify(documentWith({})))).toThrow(/does not define any HTTP operations/);
  });

  it("resolves nested local references and preserves circular references safely", () => {
    const paths = { "/node": { get: { responses: {
      "200": { description: "ok", content: { "application/json": { schema: { $ref: "#/components/schemas/Node" } } } },
    } } } };
    const spec = {
      ...documentWith(paths),
      components: { schemas: {
        Node: { type: "object", properties: { next: { $ref: "#/components/schemas/Node" }, name: { $ref: "#/components/schemas/Name" } } },
        Name: { type: "string" },
      } },
    };
    const contract = parseOpenApiText(JSON.stringify(spec));
    const response = contract.operations[0].responses["200"] as { content: Record<string, { schema: { properties: { next: unknown; name: unknown } } }> };
    const schema = response.content["application/json"].schema;
    expect(schema.properties.name).toEqual({ type: "string" });
    expect(schema.properties.next).toEqual({ $ref: "#/components/schemas/Node", circular: true });
  });

  it("rejects external and unresolved references without fetching them", () => {
    const spec = (ref: string) => JSON.stringify({
      ...documentWith({ "/x": simpleOperation({ "200": { description: "ok", content: { "application/json": { schema: { $ref: ref } } } } }) }),
    });
    expect(() => parseOpenApiText(spec("https://example.invalid/schema.json"))).toThrow(OpenApiParseError);
    expect(() => parseOpenApiText(spec("#/components/schemas/Missing"))).toThrow(/Unresolved local reference/);
  });

  it("validates operation parameters, response objects, and schema types", () => {
    const invalidParameter = documentWith({ "/x": { get: { parameters: [{ name: "q", in: "body", schema: { type: "string" } }], responses: { "200": { description: "ok" } } } } });
    const invalidResponse = documentWith({ "/x": simpleOperation({ "200": { content: {} } }) });
    const invalidSchema = documentWith({ "/x": simpleOperation({ "200": { description: "ok", content: { "application/json": { schema: { type: "null" } } } } }) });
    expect(() => parseOpenApiText(JSON.stringify(invalidParameter))).toThrow(/unsupported parameter location/);
    expect(() => parseOpenApiText(JSON.stringify(invalidResponse))).toThrow(/must include a description/);
    expect(() => parseOpenApiText(JSON.stringify(invalidSchema))).toThrow(/invalid OpenAPI 3.0 schema type/);
  });

  it("does not interpret example data named $ref as a remote reference", () => {
    const spec = documentWith({ "/x": simpleOperation({ "200": { description: "ok", content: { "application/json": { schema: { type: "object", example: { $ref: "https://example.invalid/is-data" } } } } } }) });
    const contract = parseOpenApiText(JSON.stringify(spec));
    expect(JSON.stringify(contract.document)).toContain('"$ref":"https://example.invalid/is-data"');
  });

  it("enforces the byte limit", () => expect(() => parseOpenApiText(" ".repeat(2 * 1024 * 1024 + 1))).toThrow(/2 MB/));
});

describe("OpenAPI compatibility comparison", () => {
  it("detects removed operations and response status codes", () => {
    const old = parseOpenApiText(JSON.stringify(documentWith({ "/x": { ...simpleOperation({ "200": { description: "ok" }, "404": { description: "not found" } }), post: { responses: { "201": { description: "created" } } } } })));
    const next = parseOpenApiText(JSON.stringify(documentWith({ "/x": simpleOperation({ "200": { description: "ok" } }) })));
    const changes = compareOpenApiContracts(old, next);
    expect(changes.some((change) => change.title === "Operation removed" && change.pointer.endsWith("/post"))).toBe(true);
    expect(changes.some((change) => change.title === "Response status removed" && change.pointer.endsWith("/404"))).toBe(true);
  });

  it("classifies request and response enum and nullability changes by direction", () => {
    const make = (requestEnum: string[], requestNullable: boolean, responseEnum: string[], responseNullable: boolean) => ({
      openapi: "3.0.3", info: { title: "enum", version: "1" }, paths: { "/x": { post: {
        requestBody: { content: { "application/json": { schema: { type: "string", enum: requestEnum, nullable: requestNullable } } } },
        responses: { "200": { description: "ok", content: { "application/json": { schema: { type: "string", enum: responseEnum, nullable: responseNullable } } } } },
      } } },
    });
    const before = parseOpenApiText(JSON.stringify(make(["a", "b"], false, ["a"], false)));
    const after = parseOpenApiText(JSON.stringify(make(["a"], true, ["a", "b"], true)));
    const changes = compareOpenApiContracts(before, after);
    expect(changes.find((change) => change.title === "Enum values removed" && change.kind === "enum-changed")?.severity).toBe("breaking");
    expect(changes.find((change) => change.title === "Enum values added" && change.kind === "enum-changed")?.severity).toBe("warning");
    expect(changes.find((change) => change.title === "Nullability changed" && change.pointer.includes("requestBody"))?.severity).toBe("safe");
    expect(changes.find((change) => change.title === "Nullability changed" && change.pointer.includes("responses"))?.severity).toBe("warning");
  });

  it("sorts deterministically and ignores property ordering", () => {
    const beforePaths = { "/x": { get: { responses: { "200": { description: "ok", content: { "application/json": { schema: { type: "object", properties: { a: { type: "string" }, b: { type: "number" } } } } } } } } } };
    const reorderedPaths = { "/x": { get: { responses: { "200": { description: "ok", content: { "application/json": { schema: { properties: { b: { type: "number" }, a: { type: "string" } }, type: "object" } } } } } } } };
    const before = parseOpenApiText(JSON.stringify(documentWith(beforePaths)));
    const reordered = parseOpenApiText(JSON.stringify(documentWith(reorderedPaths)));
    expect(compareOpenApiContracts(before, reordered)).toEqual([]);
  });

  it("classifies required request parameters and tightened request validation as breaking", () => {
    const spec = (required: boolean, minimum: number) => ({
      openapi: "3.0.3", info: { title: "params", version: "1" }, paths: { "/x": { get: {
        parameters: [{ name: "limit", in: "query", required, schema: { type: "integer", minimum } }],
        responses: { "200": { description: "ok" } },
      } } },
    });
    const changes = compareOpenApiContracts(parseOpenApiText(JSON.stringify(spec(false, 0))), parseOpenApiText(JSON.stringify(spec(true, 5))));
    expect(changes.find((change) => change.title === "Parameter requiredness changed")?.severity).toBe("breaking");
    expect(changes.find((change) => change.title === "Constraint changed")?.severity).toBe("breaking");
  });

  it("compares nested array schemas and classifies removed response fields as breaking", () => {
    const spec = (nestedType: string, fields: Record<string, unknown>) => {
      const schema = { type: "object", required: ["items"], properties: { items: { type: "array", items: { type: "object", properties: { ...fields, value: { type: nestedType } } } } } };
      return documentWith({ "/x": { get: { responses: { "200": { description: "ok", content: { "application/json": { schema } } } } } } });
    };
    const changes = compareOpenApiContracts(parseOpenApiText(JSON.stringify(spec("string", { id: { type: "string" } }))), parseOpenApiText(JSON.stringify(spec("number", {}))));
    expect(changes.find((change) => change.title === "Property removed")?.severity).toBe("breaking");
    expect(changes.find((change) => change.title === "Schema type changed")?.severity).toBe("breaking");
  });

  it("does not infer path renames; it reports an operation removal and addition", () => {
    const before = parseOpenApiText(JSON.stringify(documentWith({ "/old": simpleOperation({ "200": { description: "ok" } }) })));
    const after = parseOpenApiText(JSON.stringify(documentWith({ "/new": simpleOperation({ "200": { description: "ok" } }) })));
    const changes = compareOpenApiContracts(before, after);
    expect(changes.map((change) => change.kind).sort()).toEqual(["endpoint-added", "endpoint-removed"]);
    expect(changes.some((change) => change.severity === "breaking" && change.title === "Operation removed")).toBe(true);
  });

  it("ignores enum and schema-composition ordering", () => {
    const oldSchema = { type: "string", enum: ["a", "b"], anyOf: [{ type: "string" }, { type: "number" }] };
    const newSchema = { anyOf: [{ type: "number" }, { type: "string" }], enum: ["b", "a"], type: "string" };
    const before = parseOpenApiText(JSON.stringify(documentWith({ "/x": simpleOperation({ "200": { description: "ok", content: { "application/json": { schema: oldSchema } } } }) })));
    const after = parseOpenApiText(JSON.stringify(documentWith({ "/x": simpleOperation({ "200": { description: "ok", content: { "application/json": { schema: newSchema } } } }) })));
    expect(compareOpenApiContracts(before, after)).toEqual([]);
  });
});
