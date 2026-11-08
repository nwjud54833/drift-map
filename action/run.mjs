#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ACTION_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI_PATH = join(ACTION_ROOT, "packages", "driftmap", "dist", "cli.js");
const COMMENT_MARKER = "<!-- driftmap-contract-review -->";
const COMMENT_BODY_LIMIT = 60_000;
const API_VERSION = "2022-11-28";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required action environment input: ${name}`);
  return value;
}

export function pullRequestNumber(eventPath) {
  let event;
  try { event = JSON.parse(readFileSync(eventPath, "utf8")); }
  catch { throw new Error("Unable to read the GitHub event payload."); }
  const number = event?.pull_request?.number;
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error("DriftMap comment publishing requires a pull_request event.");
  }
  return number;
}

function apiHeaders(token, json = false) {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": API_VERSION,
    ...(json ? { "content-type": "application/json" } : {}),
  };
}

async function checkResponse(response, operation) {
  if (!response.ok) throw new Error(`GitHub API ${operation} failed with HTTP ${response.status}.`);
}

export async function upsertStickyComment({ apiUrl, repository, issueNumber, token, body, fetchImpl = fetch }) {
  const base = `${apiUrl.replace(/\/$/, "")}/repos/${repository}/issues/${issueNumber}/comments`;
  let existing = null;
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetchImpl(`${base}?per_page=100&page=${page}`, { headers: apiHeaders(token) });
    await checkResponse(response, "comment listing");
    const comments = await response.json();
    if (!Array.isArray(comments)) throw new Error("GitHub API returned an unexpected comments response.");
    existing = comments.find((comment) => comment?.user?.login === "github-actions[bot]"
      && typeof comment?.body === "string" && comment.body.includes(COMMENT_MARKER)) ?? existing;
    if (comments.length < 100) break;
  }

  const payload = { body: body.length > COMMENT_BODY_LIMIT ? `${body.slice(0, COMMENT_BODY_LIMIT - 80)}\n\n_Report truncated by DriftMap._` : body };
  const isUpdate = existing && Number.isSafeInteger(existing.id);
  const response = await fetchImpl(isUpdate ? `${base}/${existing.id}` : base, {
    method: isUpdate ? "PATCH" : "POST",
    headers: apiHeaders(token, true),
    body: JSON.stringify(payload),
  });
  await checkResponse(response, isUpdate ? "comment update" : "comment creation");
  return isUpdate ? "updated" : "created";
}

export async function main() {
  const baseline = required("DRIFTMAP_BASELINE_PATH");
  const candidate = required("DRIFTMAP_CANDIDATE_PATH");
  const failOn = process.env.DRIFTMAP_FAIL_ON?.trim() || "breaking";
  if (!["breaking", "warning"].includes(failOn)) throw new Error("DRIFTMAP_FAIL_ON must be breaking or warning.");
  const token = required("DRIFTMAP_GITHUB_TOKEN");
  const repository = required("GITHUB_REPOSITORY");
  if (!/^[^/]+\/[^/]+$/.test(repository)) throw new Error("GITHUB_REPOSITORY must use owner/repository format.");
  const issueNumber = pullRequestNumber(required("GITHUB_EVENT_PATH"));
  const apiUrl = process.env.GITHUB_API_URL?.trim() || "https://api.github.com";
  const args = [CLI_PATH, "diff", "--baseline", baseline, "--candidate", candidate, "--fail-on", failOn, "--format", "markdown"];
  if (process.env.DRIFTMAP_CONFIG_PATH?.trim()) args.push("--config", process.env.DRIFTMAP_CONFIG_PATH.trim());
  const { DRIFTMAP_GITHUB_TOKEN: _tokenForCommentApi, ...cliEnv } = process.env;
  const result = spawnSync(process.execPath, args, {
    cwd: process.env.GITHUB_WORKSPACE || process.cwd(),
    env: cliEnv,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw new Error(`Unable to run DriftMap CLI: ${result.error.message}`);
  if (result.status !== 0 && result.status !== 1) {
    const diagnostic = (result.stdout || result.stderr || "CLI comparison failed without a diagnostic.").trim();
    const safeDiagnostic = diagnostic.replace(/`/g, "'").slice(0, 8_000);
    const body = `${COMMENT_MARKER}\n## DriftMap contract review could not run\n\n\`\`\`text\n${safeDiagnostic}\n\`\`\``;
    await upsertStickyComment({ apiUrl, repository, issueNumber, token, body });
    return result.status || 2;
  }
  const report = (result.stdout || "").trim();
  if (!report.includes(COMMENT_MARKER)) throw new Error("DriftMap CLI did not produce the expected Markdown report.");
  await upsertStickyComment({ apiUrl, repository, issueNumber, token, body: report });
  return result.status;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((status) => { process.exitCode = status; }).catch((error) => {
    process.stderr.write(`DriftMap action error: ${error instanceof Error ? error.message : "unknown failure"}\n`);
    process.exitCode = 2;
  });
}
