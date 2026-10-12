import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { MAX_API_BODY_BYTES, readJsonBody } from "@/lib/server/api";

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
