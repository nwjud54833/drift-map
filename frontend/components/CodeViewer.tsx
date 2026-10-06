"use client";

import type { FileContentResponse } from "@/types/api";
import { formatBytes } from "@/lib/format";

interface CodeViewerProps {
  file: FileContentResponse | null;
  loading: boolean;
  error: string | null;
}

export default function CodeViewer({ file, loading, error }: CodeViewerProps) {
  if (loading) {
    return (
      <section aria-busy="true" aria-label="File viewer" className="viewer-message">
        <p className="thinking-state"><span aria-hidden="true" className="inline-spinner" /> Loading file…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-label="File viewer" className="viewer-message">
        <div role="alert" className="alert-error">
          <strong>Could not open file</strong>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  if (!file) {
    return (
      <section
        aria-label="File viewer"
        className="viewer-empty"
      >
        <span className="viewer-empty-mark" aria-hidden="true">&lt;/&gt;</span>
        <strong>No file selected</strong>
        <p>
          Choose a file from the explorer on the left to view its contents with
          line numbers.
        </p>
      </section>
    );
  }

  const lines = file.content.split(/\r\n|\r|\n/);
  if (lines.length > file.line_count && lines.at(-1) === "") lines.pop();

  return (
    <section aria-label={`File viewer: ${file.path}`} className="h-full">
      <div className="file-toolbar">
        <code className="file-path">{file.path}</code>
        <span className="file-language">
          {file.language}
        </span>
        <span className="file-meta">
          {file.line_count} lines · {formatBytes(file.size_bytes)}
        </span>
      </div>

      <div className="code-scroll scroll-thin">
        <table className="mono code-table">
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="code-row">
                <td
                  aria-hidden="true"
                  className="line-number"
                >
                  {index + 1}
                </td>
                <td className="code-line">
                  {line === "" ? " " : line}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
