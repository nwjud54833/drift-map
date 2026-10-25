"use client";

import dynamic from "next/dynamic";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ContractSnapshot } from "@/lib/contract/types";
import { parseImportArtifact } from "@/lib/workbench/import-artifact";
import { JsonInputEditorSkeleton } from "@/components/workbench/json-input-editor";

/**
 * Workbench input pane (left column).
 *
 * Rebuilt from the reference build's `#editor-baseline` / `#editor-candidate`
 * pair: two stacked editors, each with a live validity indicator and a helper
 * line, wired to the existing `parseImportArtifact` validation and the existing
 * snapshot persistence path.
 *
 * The editors are per-side rather than one shared editor with a side switch,
 * which is what the reference layout shows — a reviewer can see both documents
 * at once. Validation is derived from the draft value, so it stays in step with
 * typing without a debounce of its own.
 */

const JsonInputEditor = dynamic(() => import("@/components/workbench/json-input-editor"), {
  ssr: false,
  loading: () => <JsonInputEditorSkeleton />,
});

export interface WorkbenchInputHandle {
  /** Pretty-prints one side in place; returns a message, or null when unparseable. */
  format: (side: "before" | "after") => string | null;
  read: (side: "before" | "after") => string;
}

type Side = "before" | "after";
type ValidationState = {
  state: "empty" | "valid" | "invalid";
  message: string;
  /** How many samples (or OpenAPI operations) this editor currently holds. */
  count: number | null;
  unit: "samples" | "operations";
};

const EMPTY: ValidationState = { state: "empty", message: "No document yet", count: 0, unit: "samples" };

function validate(text: string): ValidationState {
  if (!text.trim()) return EMPTY;
  const result = parseImportArtifact(text);
  if (!result.ok) return { state: "invalid", message: result.message, count: null, unit: "samples" };
  if (result.format === "openapi") {
    const operations = result.artifact.format === "openapi" ? result.artifact.contract.operations.length : 0;
    return { state: "valid", message: `✓ OpenAPI 3.0 · ${operations} operation${operations === 1 ? "" : "s"}`, count: operations, unit: "operations" };
  }
  const samples = result.artifact.format === "samples" ? result.artifact.samples.length : 0;
  return { state: "valid", message: `✓ Valid JSON · ${samples} sample${samples === 1 ? "" : "s"}`, count: samples, unit: "samples" };
}

export interface WorkbenchInputPaneProps {
  baseline: ContractSnapshot | null;
  candidate: ContractSnapshot | null;
  activeSide: Side;
  onActiveSideChange: (side: Side) => void;
  onApply: (side: Side, text: string) => void;
  onFile: (side: Side, file: File) => void;
  /** Live traffic snippet written straight into the candidate editor. */
  streamedCandidate: string | null;
  /** Reports the combined byte size of both editors so the toolbar can show the 2 MB cap. */
  onDraftSizeChange: (bytes: number) => void;
}

export const WorkbenchInputPane = forwardRef<WorkbenchInputHandle, WorkbenchInputPaneProps>(
  function WorkbenchInputPane(
    { baseline, candidate, activeSide, onActiveSideChange, onApply, onFile, streamedCandidate, onDraftSizeChange },
    ref,
  ) {
    const [drafts, setDrafts] = useState<{ before: string; after: string }>({ before: "", after: "" });
    const draftsRef = useRef(drafts);
    draftsRef.current = drafts;

    // Load the stored snapshots into the editors whenever they change identity,
    // mirroring the reference build's `scrubSchemaTimeline` editor sync.
    useEffect(() => {
      setDrafts({
        before: baseline ? snapshotToText(baseline) : "",
        after: candidate ? snapshotToText(candidate) : "",
      });
    }, [baseline, candidate]);

    // Live traffic writes straight into the candidate editor.
    useEffect(() => {
      if (!streamedCandidate) return;
      setDrafts((current) => ({ ...current, after: streamedCandidate }));
    }, [streamedCandidate]);

    // The toolbar's "2.0 MB cap" badge reads this instead of reaching into the
    // editors, which keeps the ref internal to this component.
    useEffect(() => {
      onDraftSizeChange(new TextEncoder().encode(drafts.before + drafts.after).byteLength);
    }, [drafts, onDraftSizeChange]);

    useImperativeHandle(ref, () => ({
      read: (side) => draftsRef.current[side],
      format: (side) => {
        const draft = draftsRef.current[side];
        if (!draft.trim()) return null;
        try {
          const formatted = JSON.stringify(JSON.parse(draft), null, 2);
          setDrafts((current) => ({ ...current, [side]: formatted }));
          return side === "before" ? "Formatted baseline JSON" : "Formatted candidate JSON";
        } catch {
          return null;
        }
      },
    }), []);

    return (
      <div className="lg:col-span-4 bg-[#060608] flex flex-col divide-y divide-white/[0.08] min-w-0">
        {/* Coverage note, next to the documents that drive inference. */}
        <div className="px-4 py-2 bg-[#0A0A0D]">
          <p className="text-[10px] font-mono text-[#5E606E] leading-relaxed">
            <span className="text-[#9496A1] font-medium">Sample coverage:</span> the inferred contract only describes fields
            that appear in at least one sample. A field absent from every sample cannot be inferred, and adding more samples
            improves coverage.
          </p>
        </div>

        <EditorBlock
          side="before"
          dotClass="bg-white/60"
          label="Baseline sample(s) · v1"
          hint={<>Paste a single JSON object, an array of payloads <code className="text-[#9496A1]">[sample1, sample2]</code>, or an OpenAPI 3.0 document.</>}
          value={drafts.before}
          snapshot={baseline}
          active={activeSide === "before"}
          onFocus={() => onActiveSideChange("before")}
          onChange={(value) => setDrafts((current) => ({ ...current, before: value }))}
          onApply={() => onApply("before", draftsRef.current.before)}
          onFile={(file) => onFile("before", file)}
        />

        <EditorBlock
          side="after"
          dotClass="bg-sky-400"
          label="Candidate sample(s) · v2"
          hint={<>DriftMap normalizes array paths to <code className="text-[#9496A1]">{"/"}{"*"}</code> and compares inferred types and requiredness.</>}
          value={drafts.after}
          snapshot={candidate}
          active={activeSide === "after"}
          onFocus={() => onActiveSideChange("after")}
          onChange={(value) => setDrafts((current) => ({ ...current, after: value }))}
          onApply={() => onApply("after", draftsRef.current.after)}
          onFile={(file) => onFile("after", file)}
        />
      </div>
    );
  },
);

function EditorBlock({
  side,
  dotClass,
  label,
  hint,
  value,
  snapshot,
  active,
  onFocus,
  onChange,
  onApply,
  onFile,
}: {
  side: Side;
  dotClass: string;
  label: string;
  hint: React.ReactNode;
  value: string;
  snapshot: ContractSnapshot | null;
  active: boolean;
  onFocus: () => void;
  onChange: (value: string) => void;
  onApply: () => void;
  onFile: (file: File) => void;
}) {
  const validation = useMemo(() => validate(value), [value]);
  const editorId = `editor-${side}`;

  return (
    <div
      onFocusCapture={onFocus}
      onMouseDownCapture={onFocus}
      className={`p-4 flex-1 flex flex-col transition-colors ${active ? "bg-white/[0.015]" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
          <label htmlFor={editorId} className="text-xs font-mono uppercase tracking-wider text-white font-medium truncate">
            {label}
          </label>
          <span
            title={`${side === "before" ? "Baseline" : "Candidate"} document size, as currently typed`}
            className={`shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded border ${
              validation.count === null
                ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                : "bg-white/[0.05] text-[#9496A1] border-white/[0.08]"
            }`}
          >
            {validation.count === null ? "—" : `${validation.count} ${validation.unit}`}
          </span>
        </div>
        <span
          aria-live="polite"
          className={`text-[11px] font-mono shrink-0 ${
            validation.state === "invalid" ? "text-rose-400" : validation.state === "valid" ? "text-emerald-400" : "text-[#5E606E]"
          }`}
        >
          {validation.message}
        </span>
      </div>

      <p className="text-[11px] text-[#5E606E] mb-2">{hint}</p>

      <JsonInputEditor
        id={editorId}
        label={label}
        value={value}
        placeholder={`{\n  "id": "ORD-1001",\n  "status": "shipped"\n}`}
        onChange={onChange}
        onFile={onFile}
      />

      <div className="flex flex-wrap items-center gap-2 mt-2">
        <button
          type="button"
          onClick={onApply}
          disabled={validation.state !== "valid"}
          className="btn-geist-secondary px-2.5 py-1.5 rounded-lg text-xs font-mono text-white disabled:opacity-40"
        >
          Set as {side === "before" ? "baseline" : "candidate"}
        </button>
        {snapshot && (
          <span className="text-[10px] font-mono text-[#5E606E] ml-auto truncate">Saved: {snapshot.versionLabel}</span>
        )}
      </div>
    </div>
  );
}

function snapshotToText(snapshot: ContractSnapshot): string {
  if ("kind" in snapshot.contract && snapshot.contract.kind === "openapi") {
    return JSON.stringify(snapshot.contract.document, null, 2);
  }
  if (snapshot.samples.length === 0) return "";
  const payload = snapshot.samples.length === 1 ? snapshot.samples[0].value : snapshot.samples.map((sample) => sample.value);
  return JSON.stringify(payload, null, 2);
}
