"use client";

import type { ChangeEvent, DragEvent, KeyboardEvent, ReactNode, UIEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlignLeft, Eraser, FileUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_IMPORT_BYTES } from "@/lib/contract/parse";
import { parseImportArtifact } from "@/lib/workbench/import-artifact";
import { describeJsonErrorLocation, locateJsonError } from "@/lib/workbench/json-error";

export interface JsonEditorError {
  message: string;
  line: number | null;
  column: number | null;
}

export interface JsonInputEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Stable id prefix so the label and error message can be associated. */
  id: string;
  label: string;
  /** Describes the expected document, e.g. "JSON objects or an OpenAPI 3.0 document". */
  hint?: string;
  placeholder?: string;
  minRows?: number;
  /** Receives a validated file; the caller decides how to apply it. */
  onFile?: (file: File) => void;
  /** Renders an extra action, e.g. "Load sample". */
  extraActions?: ReactNode;
  sampleAction?: { label: string; onSelect: () => void };
  className?: string;
}

const MAX_ROWS_FOR_GUTTER = 40000;

/**
 * Token classifier for highlighting. Deliberately a single-pass scanner rather
 * than a full JSON parser: it recolours whatever the user has typed (including
 * incomplete documents) and never throws, so editing is never blocked.
 *
 * Groups map to the five token colours required by the design: keys, strings,
 * numbers, booleans and null. Everything else is neutral punctuation.
 */
function tokenize(source: string) {
  const tokens: Array<{ text: string; kind: string }> = [];
  let buffer = "";
  let kind = "plain";
  const flush = () => {
    if (buffer) tokens.push({ text: buffer, kind });
    buffer = "";
  };
  const push = () => {
    flush();
    if (source[index]) tokens.push({ text: source[index], kind: "punctuation" });
  };
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (char === '"') {
      flush();
      kind = "string";
      let value = char;
      index += 1;
      while (index < source.length) {
        const current = source[index];
        value += current;
        if (current === "\\") {
          index += 1;
          if (index < source.length) value += source[index];
        } else if (current === '"') {
          break;
        }
        index += 1;
      }
      index += 1;
      let lookahead = index;
      while (lookahead < source.length && /\s/.test(source[lookahead])) lookahead += 1;
      tokens.push({ text: value, kind: source[lookahead] === ":" ? "key" : "string" });
      continue;
    }

    if (/[\d-]/.test(char)) {
      flush();
      let value = "";
      while (index < source.length && /[0-9eE+\-.]/.test(source[index])) { value += source[index]; index += 1; }
      tokens.push({ text: value, kind: "number" });
      continue;
    }

    if (source.startsWith("true", index) || source.startsWith("false", index)) {
      flush();
      const value = source.startsWith("true", index) ? "true" : "false";
      tokens.push({ text: value, kind: "boolean" });
      index += value.length;
      continue;
    }

    if (source.startsWith("null", index)) {
      flush();
      tokens.push({ text: "null", kind: "null" });
      index += 4;
      continue;
    }

    if (char === "{" || char === "}" || char === "[" || char === "]" || char === "," || char === ":") {
      push();
      index += 1;
      continue;
    }

    flush();
    let value = "";
    while (index < source.length && !/["\d{[\]},:\-]/.test(source[index]) && !source.startsWith("true", index) && !source.startsWith("null", index)) {
      value += source[index];
      index += 1;
    }
    if (value) tokens.push({ text: value, kind: "invalid" });
    else index += 1;
  }
  flush();
  return tokens;
}

function Highlighted({ source }: { source: string }) {
  const tokens = useMemo(() => tokenize(source), [source]);
  return (
    <>
      {tokens.map((token, index) => (
        <span key={index} className={`je-token je-${token.kind}`}>{token.text}</span>
      ))}
      {"\n"}
    </>
  );
}

/**
 * JSON editor: a textarea layered over a syntax-highlighted mirror, with a
 * synchronised line-number gutter, inline parse errors that carry a line and
 * column, and drag-and-drop import.
 *
 * No editor dependency is used. The requirements are a gutter, five token
 * colours and one error position, which is far less than a full code-editor
 * bundle would add.
 */
export default function JsonInputEditor({
  value,
  onChange,
  id,
  label,
  hint,
  placeholder,
  minRows = 12,
  onFile,
  extraActions,
  sampleAction,
  className,
}: JsonInputEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<JsonEditorError | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const lineCount = useMemo(() => {
    if (value.length > MAX_ROWS_FOR_GUTTER) return 1;
    let lines = 1;
    for (let index = 0; index < value.length; index += 1) if (value.charCodeAt(index) === 10) lines += 1;
    return lines;
  }, [value]);

  /**
   * Debounced validation so a large document is not re-parsed on every
   * keystroke. Parse feedback stays immediate in the sense that nothing blocks
   * editing: the textarea is always writable while an error is displayed.
   */
  useEffect(() => {
    if (!value.trim()) { setError(null); return; }
    const timer = window.setTimeout(() => {
      const result = parseImportArtifact(value);
      if (result.ok) { setError(null); return; }
      const location = locateJsonError(new Error(result.rawMessage ?? result.message), value);
      setError({ message: result.message, line: location.line, column: location.column });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [value]);

  /**
   * The mirror (`<pre>`) is the scroll container; the transparent textarea on top
   * of it is scrolled programmatically to match. Keeping one scroll container
   * means the textarea's own scrollbar can never narrow its text box relative to
   * the rendered tokens and push the caret out of alignment.
   */
  const syncScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollLeft } = event.currentTarget;
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.scrollTop = scrollTop;
      textarea.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  }, []);

  /**
   * The caret can move without a scroll event on the container (for example
   * while typing at the edge of the visible area, or after a paste). Same-frame
   * mirroring keeps the caret and the tokens together.
   */
  const syncFromTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    if (!textarea || !highlight) return;
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
    if (gutterRef.current) gutterRef.current.scrollTop = textarea.scrollTop;
  }, []);

  /** Keeps the caret indented instead of tabbing out of the editor. */
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab" || event.shiftKey) return;
    event.preventDefault();
    const element = event.currentTarget;
    const { selectionStart, selectionEnd } = element;
    const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
    onChange(next);
    window.requestAnimationFrame(() => {
      element.selectionStart = selectionStart + 2;
      element.selectionEnd = selectionStart + 2;
    });
  }

  function readFile(file: File | undefined) {
    if (!file) return;
    setImportNotice(null);
    // Size is enforced before reading or parsing, matching the engine's cap.
    if (file.size > MAX_IMPORT_BYTES) {
      setError({ message: `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(2)} MB. Imports are capped at 2 MB.`, line: null, column: null });
      return;
    }
    if (onFile) { onFile(file); return; }
    void file.text().then((text) => {
      onChange(text);
      setImportNotice(`Loaded ${file.name}`);
    }).catch(() => setError({ message: `Unable to read “${file.name}”.`, line: null, column: null }));
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    readFile(event.dataTransfer.files?.[0]);
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    readFile(event.target.files?.[0]);
    event.target.value = "";
  }

  const errorId = `${id}-error`;
  const hintId = hint ? `${id}-hint` : undefined;
  const activeLine = error?.line ?? null;

  return (
    <div className={["je", className ?? ""].filter(Boolean).join(" ")}>
      <div className="je-toolbar">
        <label className="je-label" htmlFor={id}>{label}</label>
        <div className="je-actions">
          {sampleAction && (
            <Button size="sm" variant="quiet" onClick={sampleAction.onSelect}>
              <Sparkles size={13} aria-hidden="true" />{sampleAction.label}
            </Button>
          )}
          <Button size="sm" variant="quiet" disabled={!value.trim()} onClick={() => {
            try { onChange(JSON.stringify(JSON.parse(value), null, 2)); }
            catch { /* Formatting is a no-op while the document is invalid. */ }
          }}>
            <AlignLeft size={13} aria-hidden="true" />Format
          </Button>
          <Button size="sm" variant="quiet" onClick={() => fileInputRef.current?.click()}>
            <FileUp size={13} aria-hidden="true" />Choose file
          </Button>
          <Button size="sm" variant="quiet" disabled={!value} onClick={() => { onChange(""); setImportNotice(null); setError(null); textareaRef.current?.focus(); }}>
            <Eraser size={13} aria-hidden="true" />Clear
          </Button>
          {extraActions}
        </div>
      </div>

      {hint && <p className="je-hint" id={hintId}>{hint}</p>}

      <div
        className={`je-surface ${dragging ? "is-dragging" : ""}`}
        // The editor's height is a function of `minRows`, not of the document it
        // holds. A 2 MB payload must not be able to grow the pane and every grid
        // track beside it; the mirror inside scrolls instead.
        style={{
          "--je-surface-height": `calc(${minRows} * var(--je-line-height) + 20px)`,
          "--je-surface-min-height": `calc(${Math.min(minRows, 6)} * var(--je-line-height) + 20px)`,
        } as React.CSSProperties}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => { if (event.currentTarget.contains(event.relatedTarget as Node)) return; setDragging(false); }}
        onDrop={onDrop}
      >
        <div className="je-gutter" ref={gutterRef} aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => (
            <span key={index} className={activeLine === index + 1 ? "is-error-line" : undefined}>{index + 1}</span>
          ))}
        </div>
        <div className="je-code scroll-area" onScroll={syncScroll}>
          <pre className="je-highlight" ref={highlightRef} aria-hidden="true">
            {activeLine !== null && (
              <span className="je-error-row" style={{ top: `calc(${activeLine - 1} * var(--je-line-height))` }} />
            )}
            <Highlighted source={value} />
          </pre>
          <textarea
            id={id}
            ref={textareaRef}
            className="je-textarea"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onScroll={syncFromTextarea}
            onSelect={syncFromTextarea}
            onKeyDown={onKeyDown}
            onKeyUp={syncFromTextarea}
            onDrop={onDrop}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder={placeholder}
            aria-describedby={[hintId, error ? errorId : null].filter(Boolean).join(" ") || undefined}
            aria-invalid={error ? true : undefined}
          />
          {dragging && <div className="je-drop-hint">Drop a .json, .yaml or .yml file to import (2 MB max)</div>}
        </div>
      </div>

      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
        onChange={onFileInput}
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="je-status">
        <span className="je-metrics">
          {lineCount} {lineCount === 1 ? "line" : "lines"} · {value.length.toLocaleString()} characters · 2 MB limit
        </span>
        {importNotice && !error && <span className="je-ok" role="status">{importNotice}</span>}
      </div>

      {error && (
        <p className="je-error" id={errorId} role="status">
          <strong>{error.message}</strong>
          <span className="je-error-location">{describeJsonErrorLocation(error)}</span>
          <span className="je-error-note">Editing stays enabled while an error is present.</span>
        </p>
      )}
    </div>
  );
}

/** Skeleton with the editor's final dimensions, used while the chunk loads. */
export function JsonInputEditorSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="je je-skeleton" aria-hidden="true">
      <div className="je-toolbar">
        <span className="ui-skeleton ui-skeleton-text" style={{ width: 120 }} />
        <span className="ui-skeleton ui-skeleton-text" style={{ width: 180 }} />
      </div>
      <div className="je-surface">
        <div className="je-gutter" aria-hidden="true" />
        <div className="je-code">
          <div className="je-skeleton-lines" style={{ minHeight: `calc(${rows} * var(--je-line-height) + 20px)` }}>
            {Array.from({ length: Math.min(rows, 10) }, (_, index) => (
              <span key={index} className="ui-skeleton ui-skeleton-text" style={{ width: `${45 + ((index * 13) % 50)}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
