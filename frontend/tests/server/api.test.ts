import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { MAX_API_BODY_BYTES, assertDocumentBudget, readJsonBody } from "@/lib/server/api";
import { MAX_IMPORT_BYTES } from "@/lib/contract/parse";

describe("API JSON body limits", () => {
  it("parses a bounded JSON body", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Orders" }),
    });

    await expect(readJsonBody(request)).resolves.toEqual({ name: "Orders" });
  });

  it("stops reading an oversized streamed body even without Content-Length", async () => {
    let cancelled = false;
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(pulls === 1 ? MAX_API_BODY_BYTES : 1));
      },
      cancel() { cancelled = true; },
    });
    const request = { headers: new Headers(), body } as Request;

    await expect(readJsonBody(request)).rejects.toThrow("Request body is too large.");
    expect(pulls).toBe(2);
    expect(cancelled).toBe(true);
  });
});

describe("per-document budget", () => {
  it("accepts a document under the client import cap", () => {
    expect(() => assertDocumentBudget({ payloads: [{ note: "small" }] }, "The document")).not.toThrow();
  });

  it("rejects a document larger than the 2 MB client cap before the engine sees it", () => {
    const oversized = "x".repeat(MAX_IMPORT_BYTES + 1024);
    expect(() => assertDocumentBudget({ payloads: [{ note: oversized }] }, "The document")).toThrow(RangeError);
    expect(() => assertDocumentBudget({ payloads: [{ note: oversized }] }, "The document")).toThrow(/2 MB document limit/);
  });
});
