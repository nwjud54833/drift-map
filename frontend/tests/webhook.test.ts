import { describe, expect, it, vi } from "vitest";
import { createDriftWebhookPayload, dispatchDriftWebhook, isPublicIpAddress, validateWebhookUrlSyntax } from "@/lib/webhook";

const event = {
  event: "breaking-drift" as const,
  breaking: 2,
  warning: 1,
  safe: 3,
  info: 0,
  baseline: "https://driftmap.in/api/v1/workspaces/id/baseline?token=should-not-appear",
  candidate: "contracts/v2.json",
  link: "https://github.com/acme/api/pull/44",
};

describe("SSRF-safe webhook dispatch", () => {
  it("requires HTTPS and rejects localhost, private host literals, and non-standard ports", () => {
    expect(validateWebhookUrlSyntax("http://hooks.example.test/webhook")).toBeNull();
    expect(validateWebhookUrlSyntax("https://localhost/hook")).toBeNull();
    expect(validateWebhookUrlSyntax("https://localhost./hook")).toBeNull();
    expect(validateWebhookUrlSyntax("https://metadata.internal/hook")).toBeNull();
    expect(validateWebhookUrlSyntax("https://127.0.0.1/hook")).toBeNull();
    expect(validateWebhookUrlSyntax("https://hooks.example.test:8443/hook")).toBeNull();
  });

  it("blocks private and special IP ranges", () => {
    for (const address of ["0.0.0.0", "10.2.3.4", "127.0.0.1", "169.254.169.254", "172.20.1.1", "192.168.1.1", "100.64.0.1", "::1", "fc00::1", "fe80::1", "::ffff:10.0.0.1", "::ffff:7f00:1", "2001:db8::1"]) {
      expect(isPublicIpAddress(address), address).toBe(false);
    }
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("does not send if DNS resolves to a private address", async () => {
    const send = vi.fn();
    const result = await dispatchDriftWebhook("https://hooks.example.test/webhook", event, {
      resolve: async () => [{ address: "10.1.2.3", family: 4 }],
      send,
    });
    expect(result).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("pins a vetted public address and sends Slack/Discord-compatible summary fields", async () => {
    let sentBody = "";
    const result = await dispatchDriftWebhook("https://hooks.example.test/webhook", event, {
      resolve: async () => [{ address: "8.8.8.8", family: 4 }],
      send: async (_url, body, address) => { sentBody = body; expect(address.address).toBe("8.8.8.8"); },
    });
    expect(result).toBe(true);
    const payload = JSON.parse(sentBody);
    expect(payload.text).toContain("2 breaking");
    expect(payload.blocks[1].text.text).toContain("contracts/v2.json");
    expect(payload.embeds[0].fields).toContainEqual({ name: "Warning", value: "1", inline: true });
    expect(sentBody).not.toContain("should-not-appear");
  });

  it("selects native Slack and Discord webhook payload shapes", async () => {
    const bodies: Record<string, Record<string, unknown>> = {};
    for (const endpoint of ["https://hooks.slack.com/services/example", "https://discord.com/api/webhooks/id/token"]) {
      await dispatchDriftWebhook(endpoint, event, {
        resolve: async () => [{ address: "8.8.8.8", family: 4 }],
        send: async (url, body) => { bodies[url.hostname] = JSON.parse(body) as Record<string, unknown>; },
      });
    }
    expect(bodies["hooks.slack.com"]).toHaveProperty("blocks");
    expect(bodies["hooks.slack.com"]).not.toHaveProperty("embeds");
    expect(bodies["discord.com"]).toHaveProperty("content");
    expect(bodies["discord.com"]).toHaveProperty("embeds");
    expect(bodies["discord.com"]).not.toHaveProperty("blocks");
  });

  it("keeps webhook delivery failures non-blocking and sanitizes control characters", async () => {
    const payload = createDriftWebhookPayload({ ...event, baseline: "main\n@everyone <@channel>", link: "http://example.test/private" });
    expect(payload.text).not.toContain("\n@everyone");
    expect(payload.text).not.toContain("@everyone");
    expect(payload.text).not.toContain("http://example.test/private");
    const result = await dispatchDriftWebhook("https://hooks.example.test/webhook", event, {
      resolve: async () => [{ address: "8.8.4.4", family: 4 }],
      send: async () => { throw new Error("offline"); },
    });
    expect(result).toBe(false);
  });
});
