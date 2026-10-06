import type { JsonKind, JsonValue } from "./types";

export function getJsonKind(value: JsonValue): JsonKind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    case "object": return "object";
  }
}

export function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

export function normalizePointer(pointer: string): string {
  if (pointer === "") return "";
  if (!pointer.startsWith("/")) throw new Error("A JSON pointer must start with '/'.");
  return pointer.split("/").slice(1).map((part) => part === "*" ? "*" : part.replace(/~1/g, "/").replace(/~0/g, "~")).map(escapePointerSegment).reduce((path, part) => `${path}/${part}`, "");
}

export function pointerDepth(pointer: string): number {
  return pointer === "" ? 0 : pointer.split("/").length - 1;
}

export function pointerLabel(pointer: string): string {
  if (!pointer) return "$";
  const part = pointer.slice(pointer.lastIndexOf("/") + 1);
  return part.replace(/~1/g, "/").replace(/~0/g, "~");
}

export function exampleFor(value: JsonValue): string | number | boolean | null | "[object]" | "[array]" {
  if (Array.isArray(value)) return "[array]";
  if (value !== null && typeof value === "object") return "[object]";
  return value;
}
