import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareBaselineForCli, pullRequestNumber, shouldPromoteOnPush, upsertStickyComment } from "../../../action/run.mjs";

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

test("only promotes a baseline on an explicitly enabled push to main", () => {
  assert.equal(shouldPromoteOnPush({ eventName: "push", ref: "refs/heads/main", enabled: true }), true);
  assert.equal(shouldPromoteOnPush({ eventName: "pull_request", ref: "refs/heads/main", enabled: true }), false);
  assert.equal(shouldPromoteOnPush({ eventName: "push", ref: "refs/heads/feature", enabled: true }), false);
  assert.equal(shouldPromoteOnPush({ eventName: "push", ref: "refs/heads/main", enabled: false }), false);
});

test("moves a signed baseline URL token to the child environment instead of argv", () => {
  const env = {};
  const source = "https://driftmap.in/api/v1/workspaces/00000000-0000-4000-8000-000000000001/baseline?token=read-secret";
  const cliUrl = prepareBaselineForCli(source, env);
  assert.equal(cliUrl, "https://driftmap.in/api/v1/workspaces/00000000-0000-4000-8000-000000000001/baseline");
  assert.equal(env.DRIFTMAP_BASELINE_TOKEN, "read-secret");
  assert.doesNotMatch(cliUrl, /read-secret/);
});
