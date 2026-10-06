"use client";

import { useEffect, useRef, useState } from "react";
import type { Citation } from "@/types/api";
import { isFile } from "@/types/api";
import type { TreeNode } from "@/types/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  model?: string;
}

interface ChatPanelProps {
  selectedNode: TreeNode | null;
  messages: ChatMessage[];
  onSend: (question: string) => void;
  loading: boolean;
  error: { title: string; message: string } | null;
}

const STARTER_ACTION = "Explain this file";

export default function ChatPanel({ selectedNode, messages, onSend, loading, error }: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const disabled = selectedNode === null || !isFile(selectedNode);
  const contextPath = disabled ? null : selectedNode.path;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  function handleSend() {
    const trimmed = question.trim();
    if (!trimmed || disabled || loading) return;
    onSend(trimmed);
    setQuestion("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <section
      aria-label="AI chat"
      className="chat-panel flex flex-col"
    >
      <div className="chat-header">
        <h2 className="panel-title">Ask about this file</h2>
        {contextPath ? (
          <p className="panel-subtitle mono" title={contextPath}>
            {contextPath}
          </p>
        ) : (
          <p className="panel-subtitle">
            Select a file to enable chat.
          </p>
        )}
      </div>

      <p className="chat-notice">
        Answers are grounded in the selected file only and may be incomplete.
      </p>

      <div className="chat-scroll scroll-thin" aria-live="polite">
        {error && (
          <div className="alert-error chat-error" role="alert">
            <strong>{error.title}</strong>
            <p>{error.message}</p>
          </div>
        )}
        {messages.length === 0 && !disabled && (
          <div className="chat-empty">
            <p>Start with a question about the selected file.</p>
            <button
              type="button"
              onClick={() => onSend(STARTER_ACTION)}
              disabled={loading}
              className="starter-button"
            >
              {STARTER_ACTION}
            </button>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-message ${message.role === "user" ? "is-user" : ""}`}
          >
            <p className="message-role">
              {message.role === "user" ? "You" : "AI"}
            </p>
            <p className="message-content">{message.text}</p>
            {message.role === "assistant" && message.citations && message.citations.length > 0 && (
              <div className="citation-list">
                {message.citations.map((citation, index) => (
                  <span
                    key={`${message.id}-cit-${index}`}
                    className="mono citation-chip"
                    title={`Citation in ${citation.path}`}
                  >
                    {citation.path.split("/").pop()}:{citation.line_start}-{citation.line_end}
                  </span>
                ))}
              </div>
            )}
            {message.role === "assistant" && message.model && (
              <p className="message-model">
                {message.model}
              </p>
            )}
          </div>
        ))}

        {loading && (
          <p className="thinking-state" aria-label="Assistant is thinking">
            <span aria-hidden="true" className="inline-spinner" /> Thinking…
          </p>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-compose">
        <label htmlFor="chat-input" className="sr-only">
          Your question about the selected file
        </label>
        <textarea
          id="chat-input"
          rows={3}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          placeholder={
            disabled ? "Select a file first..." : "Ask about the selected file... (Enter to send)"
          }
          className="text-control chat-input"
        />
        <div className="compose-footer">
          <span className="compose-hint">
            Enter to send · Shift+Enter for newline
          </span>
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || loading || question.trim() === ""}
            className="button-primary send-button"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}
