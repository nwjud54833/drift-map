import { afterEach, describe, expect, it, vi } from "vitest";
import { inferContract } from "@/lib/contract/infer";
import { parsePayloadText } from "@/lib/contract/parse";
import { compareLocalContracts } from "@/lib/workbench/local-comparison";

afterEach(() => vi.unstubAllGlobals());

describe("local workbench comparison", () => {
  it("compares in the browser without requesting cloud usage", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const baseline = inferContract(parsePayloadText(JSON.stringify([{ amount: 100 }]), { source: "paste" }));
    const candidate = inferContract(parsePayloadText(JSON.stringify([{ amount: { cents: 100 } }]), { source: "paste" }));

    const changes = compareLocalContracts(baseline, candidate, "response");

    expect(changes.some((change) => change.severity === "breaking")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
