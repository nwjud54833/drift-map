"use client";

import { useState } from "react";

interface RepositoryFormProps {
  onSubmit: (repoUrl: string, branch: string | null) => void;
  loading: boolean;
}

const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;

/** Client-side pre-check only; the backend re-validates authoritatively. */
function basicValidate(url: string): string | null {
  if (!url.trim()) return "Repository URL is required.";
  if (!url.startsWith("https://")) return "URL must start with https://";
  if (!url.includes("github.com/")) return "Only github.com URLs are supported.";
  if (!GITHUB_URL_PATTERN.test(url.trim()))
    return "Expected format: https://github.com/owner/repository";
  return null;
}

export default function RepositoryForm({ onSubmit, loading }: RepositoryFormProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = basicValidate(repoUrl);
    if (error) {
      setClientError(error);
      return;
    }
    setClientError(null);
    const trimmedBranch = branch.trim();
    onSubmit(repoUrl.trim(), trimmedBranch ? trimmedBranch : null);
  }

  return (
    <section
      aria-labelledby="repo-form-heading"
      className="repo-form"
    >
      <h2 id="repo-form-heading">Open a repository</h2>
      <p className="repo-form-intro">
        Start with a public GitHub URL. The project is cloned into an isolated, read-only workspace.
      </p>

      <form onSubmit={handleSubmit} className="form-fields" noValidate>
        <div>
          <label htmlFor="repo-url" className="field-label">
            GitHub repository URL
          </label>
          <input
            id="repo-url"
            name="repo-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://github.com/owner/repository"
            value={repoUrl}
            onChange={(event) => {
              setRepoUrl(event.target.value);
              setClientError(null);
            }}
            aria-invalid={clientError ? true : undefined}
            aria-describedby={clientError ? "repo-url-error" : "repo-url-hint"}
            disabled={loading}
            className="text-control mono"
          />
          <p id="repo-url-hint" className="field-hint">
            Example: https://github.com/octocat/Hello-World
          </p>
          {clientError && (
            <p
              id="repo-url-error"
              role="alert"
              className="field-error"
            >
              {clientError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="repo-branch" className="field-label">
            Branch or tag <span>(optional)</span>
          </label>
          <input
            id="repo-branch"
            name="repo-branch"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="main"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            disabled={loading}
            className="text-control mono"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="button-primary"
        >
          {loading && (
            <span aria-hidden="true" className="inline-spinner" />
          )}
          {loading ? "Cloning and scanning..." : "Analyze Repository"}
        </button>
      </form>
    </section>
  );
}
