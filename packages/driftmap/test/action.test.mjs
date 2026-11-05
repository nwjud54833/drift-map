import assert from "node:assert/strict";
import { test } from "node:test";
import { pullRequestNumber, upsertStickyComment } from "../../../action/run.mjs";

const marker = "<!-- driftmap-contract-review -->";

test("updates only DriftMap's own sticky pull request comment", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (calls.length === 1) return new Response(JSON.stringify([
      { id: 10, user: { login: "contributor" }, body: marker },
      { id: 11, user: { login: "github-actions[bot]" }, body: marker },
    ]), { status: 200 });
    return new Response("{}", { status: 200 });
  };
  const result = await upsertStickyComment({
    apiUrl: "https://api.github.com/",
    repository: "owner/repo",
    issueNumber: 7,
    token: "test-secret",
    body: `${marker}\nreport`,
    fetchImpl,
  });
  assert.equal(result, "updated");
  assert.equal(calls[1].options.method, "PATCH");
  assert.match(calls[1].url, /\/comments\/11$/);
  assert.equal(calls[0].options.headers.authorization, "Bearer test-secret");
  assert.doesNotMatch(calls[0].url, /test-secret/);
});

test("creates the sticky report when no bot comment exists", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    return calls.length === 1
      ? new Response(JSON.stringify([{ id: 5, user: { login: "contributor" }, body: marker }]), { status: 200 })
      : new Response("{}", { status: 201 });
  };
  const result = await upsertStickyComment({
    apiUrl: "https://api.github.com",
    repository: "owner/repo",
    issueNumber: 8,
    token: "test-secret",
    body: `${marker}\nreport`,
    fetchImpl,
  });
  assert.equal(result, "created");
  assert.equal(calls[1].options.method, "POST");
});

test("reads a pull request number from its event payload", async () => {
  const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "driftmap-action-"));
  try {
    const eventFile = join(dir, "event.json");
    writeFileSync(eventFile, JSON.stringify({ pull_request: { number: 42 } }));
    assert.equal(pullRequestNumber(eventFile), 42);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
