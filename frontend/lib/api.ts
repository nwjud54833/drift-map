/**
 * Centralized API client. The browser never talks to GitHub or the LLM
 * provider directly — only to this backend.
 */

import type {
  ApiError,
  ChatResponse,
  FileContentResponse,
  RepositoryResponse,
} from "@/types/api";

export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

async function parseError(response: Response): Promise<ApiClientError> {
  let code = "UNKNOWN_ERROR";
  let message = `Request failed with status ${response.status}.`;
  try {
    const body: ApiError = await response.json();
    if (typeof body.detail === "object" && body.detail !== null) {
      code = body.detail.code ?? code;
      message = body.detail.message ?? message;
    } else if (typeof body.detail === "string") {
      message = body.detail;
    }
  } catch {
    // keep defaults
  }
  return new ApiClientError(message, code, response.status);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiClientError(
      "Cannot reach the backend. Is it running on " + API_BASE_URL + "?",
      "BACKEND_UNREACHABLE",
      0,
    );
  }
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as T;
}

/** GET /health (shape matches lib/useHealth.HealthResponse) */
export function getHealth(): Promise<{
  status: string;
  service: string;
  version: string;
  components: { db: string; redis: string; llm: string };
}> {
  return request("/health");
}

/** POST /api/repositories/clone */
export function cloneRepository(
  repoUrl: string,
  branch: string | null,
): Promise<RepositoryResponse> {
  return request("/api/repositories/clone", {
    method: "POST",
    body: JSON.stringify({ repo_url: repoUrl, branch }),
  });
}

/** GET /api/repositories/{repo_id}/tree */
export function getRepositoryTree(repoId: string): Promise<RepositoryResponse> {
  return request(`/api/repositories/${encodeURIComponent(repoId)}/tree`);
}

/** GET /api/repositories/{repo_id}/file?path=... */
export function getFile(repoId: string, path: string): Promise<FileContentResponse> {
  const params = new URLSearchParams({ path });
  return request(`/api/repositories/${encodeURIComponent(repoId)}/file?${params.toString()}`);
}

/** POST /api/chat */
export function askAboutFile(
  repoId: string,
  filePath: string,
  question: string,
): Promise<ChatResponse> {
  return request("/api/chat", {
    method: "POST",
    body: JSON.stringify({ repo_id: repoId, file_path: filePath, question }),
  });
}
