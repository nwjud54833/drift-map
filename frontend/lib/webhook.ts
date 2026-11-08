import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

export interface DriftWebhookPayloadInput {
  event: "breaking-drift" | "baseline-promoted";
  breaking: number;
  warning: number;
  safe: number;
  info: number;
  baseline: string;
  candidate: string;
  link?: string | null;
}

export interface WebhookPayload {
  text: string;
  blocks: Array<{ type: string; text?: { type: string; text: string }; fields?: Array<{ type: string; text: string }> }>;
  embeds: Array<{ title: string; description: string; color: number; url?: string; fields: Array<{ name: string; value: string; inline: boolean }> }>;
}

type Address = { address: string; family: number };
type Resolver = (hostname: string) => Promise<Address[]>;
type Sender = (url: URL, body: string, address: Address) => Promise<void>;

function cleanLabel(value: string, max = 200): string {
  let safeValue = value;
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/token|secret|signature|api[-_]?key|auth/i.test(key)) url.searchParams.delete(key);
    }
    safeValue = url.toString();
  } catch { /* A local path is not a URL. */ }
  return safeValue.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/@/g, "@\u200b") || "(unknown)";
}

function publicHttpsLink(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : undefined;
  } catch { return undefined; }
}

export function createDriftWebhookPayload(input: DriftWebhookPayloadInput): WebhookPayload {
  const promoted = input.event === "baseline-promoted";
  const title = promoted ? "DriftMap baseline promoted" : "DriftMap detected breaking API drift";
  const summary = `${input.breaking} breaking · ${input.warning} warning · ${input.safe} safe · ${input.info} info`;
  const paths = `Baseline: ${cleanLabel(input.baseline)}\nCandidate: ${cleanLabel(input.candidate)}`;
  const link = publicHttpsLink(input.link);
  const description = `${summary}\n${paths}${link ? `\n${link}` : ""}`;
  return {
    text: `${title}: ${summary}. ${paths}${link ? ` ${link}` : ""}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: title } },
      { type: "section", text: { type: "mrkdwn", text: `*${summary}*\n${paths}${link ? `\n<${link}|View pull request or commit>` : ""}` } },
    ],
    embeds: [{
      title,
      description,
      color: promoted ? 0x34d399 : 0xfb7185,
      ...(link ? { url: link } : {}),
      fields: [
        { name: "Breaking", value: String(input.breaking), inline: true },
        { name: "Warning", value: String(input.warning), inline: true },
        { name: "Safe", value: String(input.safe), inline: true },
        { name: "Info", value: String(input.info), inline: true },
      ],
    }],
  };
}

function payloadForEndpoint(url: URL, input: DriftWebhookPayloadInput): string {
  const payload = createDriftWebhookPayload(input);
  const hostname = url.hostname.toLowerCase();
  if (hostname === "hooks.slack.com" || hostname === "hooks.slack-gov.com") {
    return JSON.stringify({ text: payload.text, blocks: payload.blocks });
  }
  if ((hostname === "discord.com" || hostname === "discordapp.com") && url.pathname.startsWith("/api/webhooks/")) {
    return JSON.stringify({ content: payload.text, embeds: payload.embeds, allowed_mentions: { parse: [] } });
  }
  return JSON.stringify(payload);
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || (b === 0 && c <= 2) || (b === 88 && c === 99) || (b === 0 && c === 2)))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113);
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !isPrivateIpv4(address);
  if (family !== 6) return false;
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")
    || /^fe[89abcd]/.test(normalized) || normalized.startsWith("ff") || normalized.startsWith("::ffff:")
    || normalized.startsWith("64:ff9b:") || normalized.startsWith("2001:db8:") || normalized.startsWith("2001:10:")) return false;
  return true;
}

export function validateWebhookUrlSyntax(input: string): URL | null {
  try {
    const url = new URL(input);
    const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password || (url.port !== "" && url.port !== "443")
      || !hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")
      || hostname.endsWith(".internal") || hostname.endsWith(".lan") || hostname.endsWith(".home")
      || hostname === "metadata.google.internal" || (isIP(hostname) !== 0 && !isPublicIpAddress(hostname))) return null;
    return url;
  } catch { return null; }
}

async function resolveAddresses(hostname: string): Promise<Address[]> {
  const bareHost = hostname.replace(/^\[|\]$/g, "");
  if (isIP(bareHost)) return [{ address: bareHost, family: isIP(bareHost) }];
  return dnsLookup(bareHost, { all: true, verbatim: true });
}

function sendToPinnedAddress(url: URL, body: string, address: Address): Promise<void> {
  return new Promise((resolve, reject) => {
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const request = httpsRequest(url, {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)), "user-agent": "DriftMap-Webhook/1.0", host: url.host },
      servername: hostname,
      timeout: 5_000,
      lookup: ((_name: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
        if (options?.all) callback(null, [{ address: address.address, family: address.family }]);
        else callback(null, address.address, address.family);
      }) as never,
    }, (response) => {
      response.resume();
      if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) resolve();
      else reject(new Error("Webhook endpoint returned a non-success status."));
    });
    request.on("timeout", () => request.destroy(new Error("Webhook request timed out.")));
    request.on("error", reject);
    request.end(body);
  });
}

export async function dispatchDriftWebhook(
  input: string | undefined,
  payload: DriftWebhookPayloadInput,
  dependencies: { resolve?: Resolver; send?: Sender } = {},
): Promise<boolean> {
  if (!input?.trim()) return false;
  try {
    const url = validateWebhookUrlSyntax(input.trim());
    if (!url) return false;
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const resolver = dependencies.resolve ?? resolveAddresses;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const addresses = await Promise.race([
      resolver(hostname),
      new Promise<Address[]>((_, reject) => { timeoutId = setTimeout(() => reject(new Error("Webhook DNS lookup timed out.")), 3_000); }),
    ]).finally(() => { if (timeoutId) clearTimeout(timeoutId); });
    if (!addresses.length || addresses.some((item) => !isPublicIpAddress(item.address))) return false;
    const body = payloadForEndpoint(url, payload);
    await (dependencies.send ?? sendToPinnedAddress)(url, body, addresses[0]);
    return true;
  } catch {
    // Notifications are intentionally best-effort and never change the CI gate.
    return false;
  }
}
