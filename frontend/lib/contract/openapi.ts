import { load as loadYaml } from "js-yaml";
import { z } from "zod";
import type { ChangeKind, ChangeSeverity, ContractNode, JsonKind, JsonValue, OpenApiContract, OpenApiOperation } from "./types";
import { escapePointerSegment, pointerLabel } from "./normalize";

export const MAX_OPENAPI_BYTES = 2 * 1024 * 1024;
const MAX_OPERATIONS = 2_000;
const MAX_REFERENCE_EXPANSIONS = 20_000;
const httpMethods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema),
]));

export class OpenApiParseError extends Error {
  constructor(message: string) { super(message); this.name = "OpenApiParseError"; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateParsedTree(root: unknown): void {
  const stack: Array<{ value: unknown; depth: number; exit?: boolean }> = [{ value: root, depth: 0 }];
  const ancestors = new WeakSet<object>();
  let visited = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (current.exit) {
      if (typeof current.value === "object" && current.value !== null) ancestors.delete(current.value);
      continue;
    }
    visited += 1;
    if (visited > 100_000) throw new OpenApiParseError("The specification is too complex to process safely.");
    if (current.depth > 100) throw new OpenApiParseError("The specification is nested too deeply to process safely.");
    if (typeof current.value === "number" && !Number.isFinite(current.value)) throw new OpenApiParseError("The specification contains a non-finite number.");
    if (typeof current.value !== "object" || current.value === null) continue;
    if (ancestors.has(current.value)) throw new OpenApiParseError("Circular YAML aliases are not supported.");
    ancestors.add(current.value);
    stack.push({ value: current.value, depth: current.depth, exit: true });
    const children = Array.isArray(current.value) ? current.value : Object.values(current.value);
    for (const child of children) stack.push({ value: child, depth: current.depth + 1 });
  }
}

function decodePointerPart(part: string): string {
  if (/~(?![01])/.test(part)) throw new OpenApiParseError("The document contains an invalid local $ref pointer.");
  return part.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveReferences(root: unknown): unknown {
  let expansions = 0;
  const visit = (value: unknown, stack: Set<string>): unknown => {
    if (Array.isArray(value)) return value.map((item) => visit(item, stack));
    if (!isRecord(value)) return value;

    if (typeof value.$ref === "string") {
      const ref = value.$ref;
      if (!ref.startsWith("#/")) throw new OpenApiParseError("Remote or external $ref values are not supported. Inline the referenced definition in the document.");
      if (stack.has(ref)) return { $ref: ref, circular: true };
      expansions += 1;
      if (expansions > MAX_REFERENCE_EXPANSIONS) throw new OpenApiParseError("The document has too many references to process safely.");
      let fragment: string;
      try { fragment = decodeURIComponent(ref.slice(2)); }
      catch { throw new OpenApiParseError("The document contains a malformed local $ref URI."); }
      const target = fragment.split("/").map(decodePointerPart).reduce<unknown>((current, part) => isRecord(current) ? current[part] : undefined, root);
      if (target === undefined) throw new OpenApiParseError(`Unresolved local reference: ${ref}`);
      const nextStack = new Set(stack);
      nextStack.add(ref);
      // OpenAPI 3.0 Reference Objects ignore siblings. Resolve only the target.
      return visit(target, nextStack);
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      key,
      key === "example" || key === "examples" || key === "default" || key === "enum" || key.startsWith("x-")
        ? child
        : visit(child, stack),
    ]));
  };
  return visit(root, new Set());
}

const openApiSchemaTypes = new Set(["string", "number", "integer", "boolean", "object", "array"]);
function validateSchema(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new OpenApiParseError(`${label} must be a Schema Object.`);
  if (value.circular === true && typeof value.$ref === "string") return;
  if (value.type !== undefined && !(typeof value.type === "string" && openApiSchemaTypes.has(value.type))) {
    throw new OpenApiParseError(`${label} has an invalid OpenAPI 3.0 schema type.`);
  }
  for (const key of ["nullable", "readOnly", "writeOnly", "deprecated", "uniqueItems", "additionalProperties"]) {
    if (value[key] !== undefined && typeof value[key] !== "boolean" && !(key === "additionalProperties" && isRecord(value[key]))) throw new OpenApiParseError(`${label}.${key} has an invalid value.`);
  }
  if (value.required !== undefined && (!Array.isArray(value.required) || !value.required.every((item) => typeof item === "string"))) throw new OpenApiParseError(`${label}.required must be an array of property names.`);
  if (value.properties !== undefined && !isRecord(value.properties)) throw new OpenApiParseError(`${label}.properties must be an object.`);
  if (Array.isArray(value.properties)) throw new OpenApiParseError(`${label}.properties must be an object.`);
  for (const [name, child] of Object.entries(isRecord(value.properties) ? value.properties : {})) validateSchema(child, `${label}.properties.${name}`);
  if (value.items !== undefined) validateSchema(value.items, `${label}.items`);
  if (isRecord(value.additionalProperties)) validateSchema(value.additionalProperties, `${label}.additionalProperties`);
  for (const key of ["allOf", "oneOf", "anyOf"]) {
    if (value[key] !== undefined && (!Array.isArray(value[key]) || (value[key] as unknown[]).length === 0)) throw new OpenApiParseError(`${label}.${key} must be a non-empty array of schemas.`);
    if (Array.isArray(value[key])) (value[key] as unknown[]).forEach((child, index) => validateSchema(child, `${label}.${key}[${index}]`));
  }
  if (value.not !== undefined) validateSchema(value.not, `${label}.not`);
}

function validateMediaContent(value: unknown, label: string): void {
  if (!isRecord(value) || Object.keys(value).length === 0) throw new OpenApiParseError(`${label}.content must be a non-empty media-type object.`);
  for (const [media, item] of Object.entries(value)) {
    if (!isRecord(item)) throw new OpenApiParseError(`${label}.content.${media} must be a Media Type Object.`);
    if (item.schema !== undefined) validateSchema(item.schema, `${label}.content.${media}.schema`);
  }
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function schemaKinds(schema: unknown): JsonKind[] {
  if (!isRecord(schema)) return ["object"];
  const raw = Array.isArray(schema.type) ? schema.type : [schema.type];
  const map: Record<string, JsonKind> = { string: "string", integer: "number", number: "number", boolean: "boolean", object: "object", array: "array", null: "null" };
  const kinds: JsonKind[] = raw.flatMap((type) => typeof type === "string" && map[type] ? [map[type]] : []);
  if (schema.nullable === true && !kinds.includes("null")) kinds.push("null");
  return [...new Set<JsonKind>(kinds.length ? kinds : ["object"])].sort();
}

function makeDisplayNodes(operations: OpenApiOperation[]): ContractNode[] {
  const nodes = new Map<string, ContractNode>();
  const addSchema = (value: unknown, pointer: string, required: boolean): void => {
    if (!pointer || !isRecord(value)) return;
    const kinds = schemaKinds(value);
    const node: ContractNode = { pointer, label: pointerLabel(pointer), kinds, presentInSamples: 0, totalSamples: 0, required, examples: [] };
    nodes.set(pointer, node);
    if (isRecord(value.properties)) {
      const requiredNames = new Set(Array.isArray(value.required) ? value.required.filter((name): name is string => typeof name === "string") : []);
      for (const [name, child] of Object.entries(value.properties)) addSchema(child, `${pointer}/properties/${escapePointerSegment(name)}`, requiredNames.has(name));
    }
    if (value.items !== undefined) addSchema(value.items, `${pointer}/items`, false);
  };
  for (const operation of operations) {
    const root = `/paths/${escapePointerSegment(operation.path)}/${operation.method}`;
    nodes.set(root, { pointer: root, label: operation.method.toUpperCase(), kinds: ["object"], presentInSamples: 0, totalSamples: 0, required: true, examples: [] });
    operation.parameters.forEach((parameter) => {
      if (!isRecord(parameter)) return;
      const parameterPath = `${root}/parameters/${escapePointerSegment(`${String(parameter.in)}:${String(parameter.name)}`)}`;
      addSchema(parameter.schema, `${parameterPath}/schema`, parameter.required === true);
    });
    if (isRecord(operation.requestBody) && isRecord(operation.requestBody.content)) for (const [media, content] of Object.entries(operation.requestBody.content)) {
      if (isRecord(content)) addSchema(content.schema, `${root}/requestBody/content/${escapePointerSegment(media)}`, false);
    }
    for (const [status, response] of Object.entries(operation.responses)) if (isRecord(response) && isRecord(response.content)) {
      for (const [media, content] of Object.entries(response.content)) if (isRecord(content)) {
        addSchema(content.schema, `${root}/responses/${escapePointerSegment(status)}/content/${escapePointerSegment(media)}`, false);
      }
    }
  }
  return [...nodes.values()].sort((a, b) => a.pointer.localeCompare(b.pointer));
}

export function parseOpenApiText(rawText: string): OpenApiContract {
  if (new TextEncoder().encode(rawText).byteLength > MAX_OPENAPI_BYTES) throw new OpenApiParseError("Specification is too large. Imports are limited to 2 MB.");
  let parsed: unknown;
  try {
    const trimmed = rawText.trimStart();
    parsed = trimmed.startsWith("{") || trimmed.startsWith("[")
      ? JSON.parse(rawText) as unknown
      : loadYaml(rawText);
  } catch {
    throw new OpenApiParseError("Unable to parse the specification. Check JSON/YAML syntax and duplicate keys.");
  }
  validateParsedTree(parsed);
  const validJson = jsonValueSchema.safeParse(parsed);
  if (!validJson.success || !isRecord(parsed)) throw new OpenApiParseError("The document must be an OpenAPI 3.0 object.");
  if (typeof parsed.asyncapi === "string") throw new OpenApiParseError("AsyncAPI documents are not supported; import an OpenAPI 3.0 document.");
  if (typeof parsed.swagger === "string") throw new OpenApiParseError("Swagger 2.0 is not supported yet; convert it to OpenAPI 3.0 first.");
  if (typeof parsed.openapi !== "string") throw new OpenApiParseError("Missing OpenAPI version. Expected an OpenAPI 3.0 document.");
  if (!/^3\.0\.\d+(?:[-+].*)?$/.test(parsed.openapi)) {
    if (/^3\.1\./.test(parsed.openapi)) throw new OpenApiParseError("OpenAPI 3.1 is not supported yet; import an OpenAPI 3.0 document.");
    throw new OpenApiParseError("Unsupported API specification version. Expected OpenAPI 3.0.x.");
  }
  if (!isRecord(parsed.info) || typeof parsed.info.title !== "string" || !parsed.info.title.trim() || typeof parsed.info.version !== "string" || !parsed.info.version.trim()) throw new OpenApiParseError("OpenAPI info.title and info.version are required.");
  if (!isRecord(parsed.paths)) throw new OpenApiParseError("OpenAPI paths must be an object.");

  const resolved = resolveReferences(parsed);
  if (!isRecord(resolved) || !isRecord(resolved.paths)) throw new OpenApiParseError("OpenAPI paths must be an object.");
  if (isRecord(resolved.components)) {
    const components = resolved.components;
    if (components.schemas !== undefined) {
      if (!isRecord(components.schemas)) throw new OpenApiParseError("OpenAPI components.schemas must be an object.");
      for (const [name, schema] of Object.entries(components.schemas)) validateSchema(schema, `components.schemas.${name}`);
    }
  }
  const operations: OpenApiOperation[] = [];
  for (const [path, rawPathItem] of Object.entries(resolved.paths)) {
    if (!path.startsWith("/")) throw new OpenApiParseError(`Invalid path key ${path}. OpenAPI paths must start with '/'.`);
    if (!isRecord(rawPathItem)) throw new OpenApiParseError(`Path item ${path} must be an object.`);
    const pathItemKeys = new Set(["summary", "description", "servers", "parameters", "$ref", ...httpMethods]);
    const unknownPathItemKeys = Object.keys(rawPathItem).filter((key) => !pathItemKeys.has(key) && !key.startsWith("x-"));
    if (unknownPathItemKeys.length) throw new OpenApiParseError(`Path item ${path} contains unsupported key(s): ${unknownPathItemKeys.join(", ")}.`);
    if (rawPathItem.parameters !== undefined && !Array.isArray(rawPathItem.parameters)) throw new OpenApiParseError(`Path item ${path} parameters must be an array.`);
    const pathParameters = Array.isArray(rawPathItem.parameters) ? rawPathItem.parameters : [];
    for (const [method, rawOperation] of Object.entries(rawPathItem)) {
      if (!httpMethods.has(method.toLowerCase())) continue;
      if (!isRecord(rawOperation)) throw new OpenApiParseError(`Operation ${method.toUpperCase()} ${path} must be an object.`);
      if (!isRecord(rawOperation.responses) || Object.keys(rawOperation.responses).length === 0) throw new OpenApiParseError(`Operation ${method.toUpperCase()} ${path} must define at least one response.`);
      if (rawOperation.parameters !== undefined && !Array.isArray(rawOperation.parameters)) throw new OpenApiParseError(`Operation ${method.toUpperCase()} ${path} parameters must be an array.`);
      const localParameters = Array.isArray(rawOperation.parameters) ? rawOperation.parameters : [];
      const parameterMap = new Map<string, JsonValue>();
      for (const parameter of [...pathParameters, ...localParameters]) {
        if (!isRecord(parameter) || typeof parameter.name !== "string" || typeof parameter.in !== "string") {
          throw new OpenApiParseError(`Operation ${method.toUpperCase()} ${path} has an invalid parameter.`);
        }
        if (!["query", "header", "path", "cookie"].includes(parameter.in)) throw new OpenApiParseError(`Operation ${method.toUpperCase()} ${path} has an unsupported parameter location.`);
        if (parameter.required !== undefined && typeof parameter.required !== "boolean") throw new OpenApiParseError(`Parameter ${parameter.name} required must be a boolean.`);
        if (parameter.in === "path" && parameter.required !== true) throw new OpenApiParseError(`Path parameter ${parameter.name} must be required.`);
        if (parameter.schema === undefined && parameter.content === undefined) throw new OpenApiParseError(`Parameter ${parameter.name} must define schema or content.`);
        if (parameter.schema !== undefined && parameter.content !== undefined) throw new OpenApiParseError(`Parameter ${parameter.name} must define either schema or content, not both.`);
        if (parameter.schema !== undefined) validateSchema(parameter.schema, `parameter ${parameter.name}.schema`);
        if (parameter.content !== undefined) {
          validateMediaContent(parameter.content, `parameter ${parameter.name}`);
          if (isRecord(parameter.content) && Object.keys(parameter.content).length !== 1) throw new OpenApiParseError(`Parameter ${parameter.name} content must contain exactly one media type.`);
        }
        const checked = jsonValueSchema.safeParse(parameter);
        if (!checked.success) throw new OpenApiParseError(`Operation ${method.toUpperCase()} ${path} contains an invalid parameter value.`);
        parameterMap.set(`${parameter.in}:${parameter.name}`, checked.data);
      }
      const requestBody = rawOperation.requestBody;
      if (requestBody !== undefined && !isRecord(requestBody)) throw new OpenApiParseError(`Operation ${method.toUpperCase()} ${path} requestBody must be an object.`);
      if (isRecord(requestBody)) {
        if (requestBody.required !== undefined && typeof requestBody.required !== "boolean") throw new OpenApiParseError(`Operation ${method.toUpperCase()} ${path} requestBody.required must be a boolean.`);
        validateMediaContent(requestBody.content, `Operation ${method.toUpperCase()} ${path} requestBody`);
      }
      const requestBodyChecked = requestBody === undefined ? null : jsonValueSchema.safeParse(requestBody);
      if (requestBodyChecked && !requestBodyChecked.success) throw new OpenApiParseError(`Operation ${method.toUpperCase()} ${path} contains an invalid request body.`);
      const responses: Record<string, JsonValue> = {};
      for (const [status, response] of Object.entries(rawOperation.responses)) {
        if (!/^(?:default|[1-5](?:\d{2}|XX))$/.test(status)) throw new OpenApiParseError(`Operation ${method.toUpperCase()} ${path} has invalid response status ${status}.`);
        if (!isRecord(response) || typeof response.description !== "string") throw new OpenApiParseError(`Operation ${method.toUpperCase()} ${path} response ${status} must include a description.`);
        if (response.content !== undefined) {
          if (!isRecord(response.content)) throw new OpenApiParseError(`Operation ${method.toUpperCase()} ${path} response ${status} content must be an object.`);
          for (const [media, item] of Object.entries(response.content)) {
            if (!isRecord(item)) throw new OpenApiParseError(`Response ${status} content ${media} must be a Media Type Object.`);
            if (item.schema !== undefined) validateSchema(item.schema, `response ${status} content ${media}.schema`);
          }
        }
        const checked = jsonValueSchema.safeParse(response);
        if (!checked.success) throw new OpenApiParseError(`Operation ${method.toUpperCase()} ${path} has an invalid ${status} response.`);
        responses[status] = checked.data;
      }
      operations.push({
        key: `${path}#${method.toLowerCase()}`, path, method: method.toLowerCase(),
        operationId: typeof rawOperation.operationId === "string" ? rawOperation.operationId : null,
        summary: typeof rawOperation.summary === "string" ? rawOperation.summary : null,
        parameters: [...parameterMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, parameter]) => parameter),
        requestBody: requestBodyChecked?.success ? requestBodyChecked.data : null,
        responses: Object.fromEntries(Object.entries(responses).sort(([a], [b]) => a.localeCompare(b))),
      });
      if (operations.length > MAX_OPERATIONS) throw new OpenApiParseError("The specification has too many operations to process safely.");
    }
  }
  if (!operations.length) throw new OpenApiParseError("The specification does not define any HTTP operations.");
  const normalized = stable(parsed);
  const checkedDocument = jsonValueSchema.safeParse(normalized);
  if (!checkedDocument.success) throw new OpenApiParseError("The specification contains values that cannot be normalized safely.");
  const orderedOperations = operations.sort((a, b) => a.key.localeCompare(b.key));
  return { kind: "openapi", version: "3.0", title: parsed.info.title.trim(), document: checkedDocument.data, operations: orderedOperations, nodes: makeDisplayNodes(orderedOperations) };
}

export interface OpenApiChange {
  id: string;
  pointer: string;
  kind: ChangeKind;
  severity: ChangeSeverity;
  title: string;
  explanation: string;
  before: JsonValue | null;
  after: JsonValue | null;
}

export class OpenApiComparisonError extends Error {
  constructor() { super("The comparison produced too many changes to return safely. Reduce the specification size or compare smaller API sections."); this.name = "OpenApiComparisonError"; }
}

function addChange(output: OpenApiChange[], item: OpenApiChange): void {
  if (output.length >= 10_000) throw new OpenApiComparisonError();
  output.push(item);
}

function jsonEqual(a: unknown, b: unknown): boolean { return JSON.stringify(stable(a)) === JSON.stringify(stable(b)); }
function jsonSetEqual(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((value) => b.some((candidate) => jsonEqual(value, candidate)));
}
function compositionEqual(key: string, a: unknown, b: unknown): boolean {
  if (["allOf", "oneOf", "anyOf"].includes(key) && Array.isArray(a) && Array.isArray(b)) {
    const left = a.map((item) => JSON.stringify(stable(item))).sort();
    const right = b.map((item) => JSON.stringify(stable(item))).sort();
    return jsonEqual(left, right);
  }
  return jsonEqual(a, b);
}
function schemaTypes(schema: unknown): string[] {
  if (!isRecord(schema)) return [];
  return Array.isArray(schema.type) ? schema.type.filter((item): item is string => typeof item === "string").sort() : typeof schema.type === "string" ? [schema.type] : [];
}

function compareSchema(before: unknown, after: unknown, pointer: string, request: boolean, output: OpenApiChange[]): void {
  const schemaKind: ChangeKind = request ? "request-schema-changed" : "response-schema-changed";
  if (jsonEqual(before, after)) return;
  if (!isRecord(before) || !isRecord(after)) {
    addChange(output, change(pointer, schemaKind, request ? "breaking" : "warning", "Schema changed", "The schema shape changed; compatibility cannot be proven from this difference alone.", before, after));
    return;
  }
  const beforeTypes = schemaTypes(before); const afterTypes = schemaTypes(after);
  if (!jsonEqual(beforeTypes, afterTypes) && (beforeTypes.length || afterTypes.length)) {
    addChange(output, change(pointer, schemaKind, "breaking", "Schema type changed", `The declared type changed from ${beforeTypes.join(" | ") || "unspecified"} to ${afterTypes.join(" | ") || "unspecified"}.`, before, after));
    return;
  }
  const beforeEnum = Array.isArray(before.enum) ? before.enum : null;
  const afterEnum = Array.isArray(after.enum) ? after.enum : null;
  if (!(beforeEnum !== null && afterEnum !== null && jsonSetEqual(beforeEnum, afterEnum)) && (beforeEnum !== null || afterEnum !== null)) {
    const narrowed = beforeEnum === null ? afterEnum !== null : afterEnum !== null && afterEnum.every((value) => beforeEnum.some((old) => jsonEqual(value, old)));
    const severity = request ? (narrowed ? "breaking" : "safe") : (narrowed ? "safe" : "warning");
    const title = beforeEnum === null ? "Enum values constrained" : afterEnum === null ? "Enum constraint removed" : narrowed ? "Enum values removed" : "Enum values added";
    addChange(output, change(`${pointer}/enum`, "enum-changed", severity, title, request ? "Request enum changes alter the values callers may send." : "Response enum changes alter the values consumers may receive.", beforeEnum as JsonValue, afterEnum as JsonValue));
  }
  const beforeNullable = before.nullable === true;
  const afterNullable = after.nullable === true;
  if (beforeNullable !== afterNullable) {
    const severity = request ? (beforeNullable && !afterNullable ? "breaking" : "safe") : (!beforeNullable && afterNullable ? "warning" : "safe");
    addChange(output, change(`${pointer}/nullable`, "nullability-changed", severity, "Nullability changed", request ? "The request schema changed whether callers may send null." : "The response schema changed whether consumers may receive null.", before.nullable === true, after.nullable === true));
  }
  if (before.format !== after.format && (before.format !== undefined || after.format !== undefined)) {
    addChange(output, change(`${pointer}/format`, "format-changed", "warning", "Format changed", "The declared format changed; compatibility depends on client and server validation behavior.", (before.format ?? null) as JsonValue, (after.format ?? null) as JsonValue));
  }
  for (const key of ["allOf", "oneOf", "anyOf", "not", "discriminator", "readOnly", "writeOnly"]) {
    if (!compositionEqual(key, before[key], after[key]) && (before[key] !== undefined || after[key] !== undefined)) {
      addChange(output, change(`${pointer}/${key}`, "constraint-changed", "warning", "Composed schema changed", `The ${key} schema rule changed; the compatibility direction is ambiguous for this composition.`, (before[key] ?? null) as JsonValue, (after[key] ?? null) as JsonValue));
    }
  }
  for (const key of ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "pattern", "minItems", "maxItems", "uniqueItems"]) {
    if (before[key] !== after[key] && (before[key] !== undefined || after[key] !== undefined)) {
      const tightening = constraintTightening(key, before[key], after[key]);
      const severity = tightening === null ? "warning" : request ? (tightening ? "breaking" : "safe") : (tightening ? "safe" : "warning");
      addChange(output, change(`${pointer}/${key}`, "constraint-changed", severity, "Constraint changed", tightening === null
        ? `The ${key} constraint changed in a way whose compatibility cannot be determined automatically.`
        : `The ${key} constraint ${tightening ? "became stricter" : "became looser"}; ${request ? "stricter request validation can reject callers" : "looser response constraints may expose values consumers did not previously expect"}.`,
      (before[key] ?? null) as JsonValue, (after[key] ?? null) as JsonValue));
    }
  }
  const beforeRequired = new Set(Array.isArray(before.required) ? before.required.filter((item): item is string => typeof item === "string") : []);
  const afterRequired = new Set(Array.isArray(after.required) ? after.required.filter((item): item is string => typeof item === "string") : []);
  const beforeProps = isRecord(before.properties) ? before.properties : {};
  const afterProps = isRecord(after.properties) ? after.properties : {};
  for (const field of new Set([...beforeRequired, ...afterRequired])) if (beforeRequired.has(field) !== afterRequired.has(field) && field in beforeProps && field in afterProps) {
    const added = afterRequired.has(field);
    const severity = request ? (added ? "breaking" : "safe") : (added ? "warning" : "breaking");
    addChange(output, change(`${pointer}/required/${field}`, "requiredness-changed", severity, added ? "Property became required" : "Property became optional", request ? "Request requiredness changes affect what callers must send." : "Response requiredness changes affect what consumers may rely on.", beforeRequired.has(field), afterRequired.has(field)));
  }
  for (const name of new Set([...Object.keys(beforeProps), ...Object.keys(afterProps)])) {
    const childPointer = `${pointer}/properties/${name.replace(/~/g, "~0").replace(/\//g, "~1")}`;
    if (!(name in beforeProps)) addChange(output, change(childPointer, "property-added", request ? (afterRequired.has(name) ? "breaking" : "safe") : (afterRequired.has(name) ? "warning" : "safe"), "Property added", "A schema property was added. Requiredness is taken from the declared required list.", null, afterProps[name] as JsonValue));
    else if (!(name in afterProps)) addChange(output, change(childPointer, "property-removed", request ? (beforeRequired.has(name) ? "breaking" : "safe") : "breaking", "Property removed", "A schema property was removed.", beforeProps[name] as JsonValue, null));
    else compareSchema(beforeProps[name], afterProps[name], childPointer, request, output);
  }
  if (!jsonEqual(before.items, after.items) && (before.items !== undefined || after.items !== undefined)) compareSchema(before.items, after.items, `${pointer}/items`, request, output);
  if (isRecord(before.additionalProperties) && isRecord(after.additionalProperties)) {
    compareSchema(before.additionalProperties, after.additionalProperties, `${pointer}/additionalProperties`, request, output);
  } else if (before.additionalProperties !== after.additionalProperties && (before.additionalProperties !== undefined || after.additionalProperties !== undefined)) {
    const tighter = (before.additionalProperties === undefined || before.additionalProperties === true) && (after.additionalProperties === false || isRecord(after.additionalProperties));
    const looser = before.additionalProperties === false && after.additionalProperties !== false
      || isRecord(before.additionalProperties) && (after.additionalProperties === undefined || after.additionalProperties === true);
    const severity = tighter ? (request ? "breaking" : "safe") : looser ? (request ? "safe" : "warning") : "warning";
    addChange(output, change(`${pointer}/additionalProperties`, "additional-properties-changed", severity, "Additional properties changed", request
      ? "The request schema changed whether or which unspecified object properties callers may send."
      : "The response schema changed whether or which unspecified object properties consumers may receive.",
    (before.additionalProperties ?? null) as JsonValue, (after.additionalProperties ?? null) as JsonValue));
  }
}

function constraintTightening(name: string, before: unknown, after: unknown): boolean | null {
  if (name === "pattern") return null;
  if (name === "uniqueItems") return before !== true && after === true ? true : before === true && after !== true ? false : null;
  if (before === undefined && typeof after === "number") return true;
  if (typeof before === "number" && after === undefined) return false;
  if (typeof before !== "number" || typeof after !== "number") return null;
  if (["minimum", "exclusiveMinimum", "minLength", "minItems"].includes(name)) return after > before;
  if (["maximum", "exclusiveMaximum", "maxLength", "maxItems"].includes(name)) return after < before;
  return null;
}

function change(pointer: string, kind: ChangeKind, severity: ChangeSeverity, title: string, explanation: string, before: unknown, after: unknown): OpenApiChange {
  return { id: `${pointer}:${title}`, pointer, kind, severity, title, explanation, before: (before ?? null) as JsonValue | null, after: (after ?? null) as JsonValue | null };
}

function contentSchemas(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value.content)) return {};
  return Object.fromEntries(Object.entries(value.content).map(([media, item]) => [media, isRecord(item) ? item.schema : undefined]));
}

export function compareOpenApiContracts(before: OpenApiContract, after: OpenApiContract): OpenApiChange[] {
  const output: OpenApiChange[] = [];
  const oldOps = new Map(before.operations.map((operation) => [operation.key, operation]));
  const newOps = new Map(after.operations.map((operation) => [operation.key, operation]));
  for (const key of new Set([...oldOps.keys(), ...newOps.keys()])) {
    const oldOp = oldOps.get(key); const newOp = newOps.get(key);
    const operation = oldOp ?? newOp!;
    const operationPointer = `/paths/${escapePointerSegment(operation.path)}/${operation.method}`;
    if (!oldOp) { addChange(output, change(operationPointer, "endpoint-added", "safe", "Operation added", "A new path and HTTP method are available; existing operations are unchanged.", null, key)); continue; }
    if (!newOp) { addChange(output, change(operationPointer, "endpoint-removed", "breaking", "Operation removed", "Removing a documented HTTP operation can break existing callers.", key, null)); continue; }
    const oldParams = new Map(oldOp.parameters.map((parameter) => [isRecord(parameter) ? `${String(parameter.in)}:${String(parameter.name)}` : "", parameter]));
    const newParams = new Map(newOp.parameters.map((parameter) => [isRecord(parameter) ? `${String(parameter.in)}:${String(parameter.name)}` : "", parameter]));
    for (const paramKey of new Set([...oldParams.keys(), ...newParams.keys()])) {
      const left = oldParams.get(paramKey); const right = newParams.get(paramKey); const pointer = `${operationPointer}/parameters/${escapePointerSegment(paramKey)}`;
      if (left === undefined) addChange(output, change(pointer, "parameter-added", isRecord(right) && right.required === true ? "breaking" : "safe", "Parameter added", "A parameter was added; a newly required request parameter can break callers.", null, right));
      else if (right === undefined) addChange(output, change(pointer, "parameter-removed", "breaking", "Parameter removed", "Removing a request parameter can break callers that rely on it.", left, null));
      else if (!jsonEqual(left, right)) {
        const leftSchema = isRecord(left) ? left.schema : undefined; const rightSchema = isRecord(right) ? right.schema : undefined;
        if (!jsonEqual(leftSchema, rightSchema)) compareSchema(leftSchema, rightSchema, `${pointer}/schema`, true, output);
        const leftContent = contentSchemas(left); const rightContent = contentSchemas(right);
        for (const media of new Set([...Object.keys(leftContent), ...Object.keys(rightContent)])) {
          const oldSchema = leftContent[media]; const newSchema = rightContent[media];
          const contentPointer = `${pointer}/content/${escapePointerSegment(media)}`;
          if (oldSchema === undefined && newSchema !== undefined) addChange(output, change(contentPointer, "parameter-changed", "safe", "Parameter representation added", "A request parameter now accepts an additional content representation.", null, newSchema));
          else if (oldSchema !== undefined && newSchema === undefined) addChange(output, change(contentPointer, "parameter-changed", "breaking", "Parameter representation removed", "A request parameter no longer accepts a content representation.", oldSchema, null));
          else compareSchema(oldSchema, newSchema, contentPointer, true, output);
        }
        if (isRecord(left) && isRecord(right) && left.required !== right.required) addChange(output, change(`${pointer}/required`, "parameter-changed", right.required === true ? "breaking" : "safe", "Parameter requiredness changed", "Making a request parameter required can break existing callers; making it optional relaxes the request contract.", left.required === true, right.required === true));
        const serializationKeys = ["style", "explode", "allowReserved", "allowEmptyValue"];
        if (isRecord(left) && isRecord(right) && serializationKeys.some((name) => left[name] !== right[name])) addChange(output, change(`${pointer}/serialization`, "parameter-changed", "warning", "Parameter serialization changed", "Parameter encoding changed; compatibility depends on client and server serialization behavior.", left as JsonValue, right as JsonValue));
      }
    }
    const oldBodySchemas = contentSchemas(oldOp.requestBody); const newBodySchemas = contentSchemas(newOp.requestBody);
    if (oldOp.requestBody === null && newOp.requestBody !== null) {
      const required = isRecord(newOp.requestBody) && newOp.requestBody.required === true;
      addChange(output, change(`${operationPointer}/requestBody`, "request-schema-changed", required ? "breaking" : "safe", "Request body added", required ? "The operation now requires a request body, which can break existing callers." : "The operation now documents an optional request body.", null, newOp.requestBody));
    }
    else if (oldOp.requestBody !== null && newOp.requestBody === null) addChange(output, change(`${operationPointer}/requestBody`, "request-schema-changed", "breaking", "Request body removed", "The operation no longer documents a request body.", oldOp.requestBody, null));
    else {
      const beforeRequired = isRecord(oldOp.requestBody) && oldOp.requestBody.required === true;
      const afterRequired = isRecord(newOp.requestBody) && newOp.requestBody.required === true;
      if (beforeRequired !== afterRequired) addChange(output, change(`${operationPointer}/requestBody/required`, "request-schema-changed", afterRequired ? "breaking" : "safe", "Request body requiredness changed", afterRequired ? "The request body is now required, so existing callers that omit it may fail." : "The request body is now optional, which relaxes the caller contract.", beforeRequired, afterRequired));
      for (const media of new Set([...Object.keys(oldBodySchemas), ...Object.keys(newBodySchemas)])) {
        const oldSchema = oldBodySchemas[media]; const newSchema = newBodySchemas[media];
        const mediaPointer = `${operationPointer}/requestBody/content/${escapePointerSegment(media)}`;
        if (oldSchema === undefined && newSchema !== undefined) addChange(output, change(mediaPointer, "request-schema-changed", "safe", "Request representation added", "A new request content representation is accepted.", null, newSchema));
        else if (oldSchema !== undefined && newSchema === undefined) addChange(output, change(mediaPointer, "request-schema-changed", "breaking", "Request representation removed", "A request content representation is no longer accepted.", oldSchema, null));
        else compareSchema(oldSchema, newSchema, mediaPointer, true, output);
      }
    }

    for (const status of new Set([...Object.keys(oldOp.responses), ...Object.keys(newOp.responses)])) {
      const left = oldOp.responses[status]; const right = newOp.responses[status]; const pointer = `${operationPointer}/responses/${escapePointerSegment(status)}`;
      if (left === undefined) addChange(output, change(pointer, "response-status-added", "safe", "Response status added", "A documented response status was added.", null, right));
      else if (right === undefined) addChange(output, change(pointer, "response-status-removed", "breaking", "Response status removed", "Removing a documented response status can break consumers that handle it.", left, null));
      else {
        const oldSchemas = contentSchemas(left); const newSchemas = contentSchemas(right);
        for (const media of new Set([...Object.keys(oldSchemas), ...Object.keys(newSchemas)])) {
          const oldSchema = oldSchemas[media]; const newSchema = newSchemas[media];
          const mediaPointer = `${pointer}/content/${escapePointerSegment(media)}`;
          if (oldSchema === undefined && newSchema !== undefined) addChange(output, change(mediaPointer, "response-schema-changed", "safe", "Response representation added", "A new response content representation is documented.", null, newSchema));
          else if (oldSchema !== undefined && newSchema === undefined) addChange(output, change(mediaPointer, "response-schema-changed", "breaking", "Response representation removed", "A response content representation is no longer documented.", oldSchema, null));
          else compareSchema(oldSchema, newSchema, mediaPointer, false, output);
        }
      }
    }
  }
  const rank = { breaking: 0, warning: 1, safe: 2, info: 3 };
  return output.sort((a, b) => rank[a.severity] - rank[b.severity] || a.pointer.localeCompare(b.pointer) || a.title.localeCompare(b.title));
}
