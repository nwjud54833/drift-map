import { z } from "zod";
import type { JsonObject, JsonValue, PayloadSample, SnapshotSource } from "./types";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema),
]));
const objectSchema = z.record(z.string(), jsonValueSchema);

export class PayloadParseError extends Error {
  constructor(message: string) { super(message); this.name = "PayloadParseError"; }
}

function validateValue(value: unknown): JsonValue {
  const parsed = jsonValueSchema.safeParse(value);
  if (!parsed.success) throw new PayloadParseError("The JSON contains a value that cannot be safely imported.");
  return parsed.data;
}

export function parsePayloadText(rawText: string, options: { source?: SnapshotSource; fileName?: string | null; now?: string } = {}): PayloadSample[] {
  if (new TextEncoder().encode(rawText).byteLength > MAX_IMPORT_BYTES) throw new PayloadParseError("File too large. DriftMap supports JSON payloads up to 2 MB in the MVP.");
  let unknownValue: unknown;
  try { unknownValue = JSON.parse(rawText) as unknown; }
  catch { throw new PayloadParseError("Unable to parse JSON. Check the syntax and try again."); }
  const value = validateValue(unknownValue);
  const values: JsonObject[] = Array.isArray(value)
    ? value.map((entry, index) => {
        const object = objectSchema.safeParse(entry);
        if (!object.success) throw new PayloadParseError(`The imported array must contain JSON objects (item ${index + 1} is not an object).`);
        return object.data;
      })
    : (() => {
        const object = objectSchema.safeParse(value);
        if (!object.success) throw new PayloadParseError("Unsupported payload. The top-level value must be an object or an array of objects.");
        return [object.data];
      })();
  if (values.length === 0) throw new PayloadParseError("The JSON array is empty. Import at least one object sample.");
  const capturedAt = options.now ?? new Date().toISOString();
  const source = options.source ?? "paste";
  return values.map((item, index) => ({
    id: `sample_${index + 1}`,
    label: typeof item.event_type === "string" ? item.event_type : typeof item.id === "string" ? item.id : `Sample ${index + 1}`,
    value: item,
    source,
    capturedAt,
  }));
}

export async function parsePayloadFile(file: File): Promise<PayloadSample[]> {
  if (file.size > MAX_IMPORT_BYTES) throw new PayloadParseError("File too large. DriftMap supports JSON payloads up to 2 MB in the MVP.");
  if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") throw new PayloadParseError("Choose a .json file to import.");
  return parsePayloadText(await file.text(), { source: "file", fileName: file.name });
}
