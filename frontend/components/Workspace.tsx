"use client";

import { useCallback, useRef, useState } from "react";
import type { FileContentResponse, RepositoryResponse, TreeNode } from "@/types/api";
import { isFile } from "@/types/api";
import { ApiClientError, askAboutFile, cloneRepository, getFile } from "@/lib/api";
import RepositoryForm from "@/components/RepositoryForm";
import FileTree from "@/components/FileTree";
import CodeViewer from "@/components/CodeViewer";
import ChatPanel, { type ChatMessage } from "@/components/ChatPanel";

type Phase = "form" | "loading" | "ready";

interface ErrorState {
  title: string;
  message: string;
}

function errorMessage(error: unknown): ErrorState {
  if (error instanceof ApiClientError) {
    if (error.code === "LLM_NOT_CONFIGURED") {
      return {
        title: "AI is not configured",
        message:
          "Set LLM_API_KEY (and optionally LLM_BASE_URL / LLM_MODEL) in backend/.env, then restart the backend.",
      };
    }
    return { title: "Request failed", message: error.message };
  }
  return {
    title: "Unexpected error",
    message: error instanceof Error ? error.message : "Something went wrong.",
  };
}

export default function Workspace() {
  const [phase, setPhase] = useState<Phase>("form");
  const [repo, setRepo] = useState<RepositoryResponse | null>(null);
  const [loadError, setLoadError] = useState<ErrorState | null>(null);

  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [fileContent, setFileContent] = useState<FileContentResponse | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<ErrorState | null>(null);
  const chatRequestId = useRef(0);
  const chatContextKey = useRef<string | null>(null);
  const fileRequestId = useRef(0);

  const handleClone = useCallback(async (repoUrl: string, branch: string | null) => {
    chatRequestId.current += 1;
    fileRequestId.current += 1;
    chatContextKey.current = null;
    setMessages([]);
    setChatLoading(false);
    setChatError(null);
    setSelectedNode(null);
    setFileContent(null);
    setFileLoading(false);
    setFileError(null);
    setPhase("loading");
    setLoadError(null);
    try {
      const result = await cloneRepository(repoUrl, branch);
      setRepo(result);
      setPhase("ready");
    } catch (error) {
      setLoadError(errorMessage(error));
      setPhase("form");
    }
  }, []);

  const handleSelectFile = useCallback(
    async (node: TreeNode) => {
      if (!isFile(node) || !repo) return;
      const requestId = ++fileRequestId.current;
      const nextContextKey = `${repo.repo_id}:${node.path}`;
      if (chatContextKey.current !== nextContextKey) {
        chatRequestId.current += 1;
        chatContextKey.current = nextContextKey;
        setMessages([]);
        setChatLoading(false);
        setChatError(null);
      }
      setSelectedNode(node);
      setFileContent(null);
      setFileError(null);
      setChatError(null);
      setFileLoading(true);
      try {
        const content = await getFile(repo.repo_id, node.path);
        if (fileRequestId.current !== requestId) return;
        setFileContent(content);
      } catch (error) {
        if (fileRequestId.current !== requestId) return;
        const err = errorMessage(error);
        setFileError(err.message);
      } finally {
        if (fileRequestId.current === requestId) setFileLoading(false);
      }
    },
    [repo],
  );

  const handleSend = useCallback(
    async (question: string) => {
      if (!repo || !selectedNode || !isFile(selectedNode) || chatLoading) return;
      const requestId = ++chatRequestId.current;
      const userMessage: ChatMessage = {
        id: `u-${requestId}`,
        role: "user",
        text: question,
      };
      setMessages((prev) => [...prev, userMessage]);
      setChatLoading(true);
      setChatError(null);
      try {
        const response = await askAboutFile(repo.repo_id, selectedNode.path, question);
        if (chatRequestId.current !== requestId) return;
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${requestId}`,
            role: "assistant",
            text: response.answer,
            citations: response.citations,
            model: response.model,
          },
        ]);
      } catch (error) {
        if (chatRequestId.current !== requestId) return;
        const err = errorMessage(error);
        setChatError(err);
      } finally {
        if (chatRequestId.current === requestId) setChatLoading(false);
      }
    },
    [repo, selectedNode, chatLoading],
  );

  if (phase !== "ready" || !repo) {
    return (
      <main>
        {phase === "loading" ? (
          <div className="loading-state" aria-busy="true">
            <span aria-hidden="true" className="inline-spinner" />
            <p>Cloning and scanning repository…</p>
          </div>
        ) : (
          <>
            <div className="welcome-main">
              <div className="welcome-layout">
                <section aria-labelledby="welcome-title">
                  <span className="eyebrow">Codebase workspace</span>
                  <h1 id="welcome-title" className="welcome-title">A clearer view of your code.</h1>
                  <p className="welcome-description">
                    Explore a repository file by file, then ask focused questions with answers grounded in the code you select.
                  </p>
                  <div className="welcome-note">
                    <span className="status-dot" aria-hidden="true" />
                    <span>Repositories stay read-only in an isolated workspace. Source code is never executed.</span>
                  </div>
                </section>
                <div>
                  <RepositoryForm onSubmit={handleClone} loading={false} />
                  {loadError && (
                    <div role="alert" className="alert-error welcome-error">
                      <strong>{loadError.title}</strong>
                      <p>{loadError.message}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    );
  }

  const languageEntries = Object.entries(repo.detected_languages).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <main className="workspace-main">
      <div className="repo-toolbar">
        <div className="repo-heading">
          <div className="repo-name">{repo.repo_name}</div>
        {repo.default_branch && (
            <div className="repo-branch mono">{repo.default_branch}</div>
        )}
        </div>
        <span className="repo-stat">{repo.total_files} files</span>
        <div className="language-list">
          {languageEntries.slice(0, 6).map(([language, count]) => (
            <span key={language} className="language-chip">
              {language} ({count})
            </span>
          ))}
        </div>
        <a
          href={repo.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="repo-link"
        >
          View on GitHub
        </a>
      </div>

      <div className="workspace-grid">
        <aside
          aria-label="File explorer"
          className="explorer-panel"
        >
          <div className="panel-heading">
            <h2 className="panel-title">Files</h2>
            <span className="panel-subtitle">{repo.total_files} total</span>
          </div>
          <FileTree
            tree={repo.file_tree}
            selectedPath={selectedNode && isFile(selectedNode) ? selectedNode.path : null}
            onSelectFile={handleSelectFile}
          />
        </aside>

        <section aria-label="Code viewer" className="viewer-panel">
          <CodeViewer file={fileContent} loading={fileLoading} error={fileError} />
        </section>

        <ChatPanel
          selectedNode={selectedNode}
          messages={messages}
          onSend={handleSend}
          loading={chatLoading}
          error={chatError}
        />
      </div>
    </main>
  );
}
