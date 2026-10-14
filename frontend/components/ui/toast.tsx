"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

export type ToastTone = "success" | "info" | "error";

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastRecord {
  id: string;
  tone: ToastTone;
  message: string;
  /** Milliseconds before auto-dismiss. 0 keeps the toast until dismissed. */
  duration: number;
  action?: ToastAction;
}

interface ToastState {
  toasts: ToastRecord[];
  push: (toast: Omit<ToastRecord, "id" | "duration"> & { duration?: number }) => string;
  dismiss: (id: string) => void;
}

let sequence = 0;
const nextId = () => `toast_${(sequence += 1)}`;

/**
 * Toasts live in a store rather than component state because workbench async
 * actions (imports, exports, deletes, cloud failures) are spread across many
 * callbacks and several levels of the tree.
 *
 * Errors default to `duration: 0` — they stay until dismissed, per the brief.
 * Everything else auto-dismisses.
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ tone, message, action, duration }) => {
    const id = nextId();
    const resolved = duration ?? (tone === "error" ? 0 : 3200);
    set((state) => ({ toasts: [...state.toasts, { id, tone, message, action, duration: resolved }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

/** Imperative helpers usable from anywhere, including outside React. */
export const toast = {
  success: (message: string, action?: ToastAction) => useToastStore.getState().push({ tone: "success", message, action }),
  info: (message: string, action?: ToastAction) => useToastStore.getState().push({ tone: "info", message, action }),
  error: (message: string, action?: ToastAction) => useToastStore.getState().push({ tone: "error", message, action }),
};

const ICON = { success: CircleCheck, info: Info, error: CircleAlert } as const;

function ToastItem({ record }: { record: ToastRecord }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const Icon = ICON[record.tone];

  useEffect(() => {
    if (record.duration <= 0) return;
    const timer = window.setTimeout(() => dismiss(record.id), record.duration);
    return () => window.clearTimeout(timer);
  }, [record.id, record.duration, dismiss]);

  return (
    <div className="ui-toast" data-tone={record.tone}>
      <Icon className="ui-toast-icon" size={15} aria-hidden="true" />
      <div className="ui-toast-body">{record.message}</div>
      <div className="ui-toast-actions">
        {record.action && (
          <button
            type="button"
            className="ui-toast-action"
            onClick={() => { record.action?.run(); dismiss(record.id); }}
          >
            {record.action.label}
          </button>
        )}
        <button type="button" className="ui-toast-dismiss" aria-label="Dismiss notification" onClick={() => dismiss(record.id)}>
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Two live regions: polite for confirmations, assertive for errors. `aria-live`
 * is fixed at render time because assistive technology does not reliably pick
 * up a live region whose politeness changes after it is created.
 */
export function ToastRegion() {
  const toasts = useToastStore((state) => state.toasts);
  const polite = toasts.filter((record) => record.tone !== "error");
  const assertive = toasts.filter((record) => record.tone === "error");
  return (
    <>
      <div className="ui-toast-region" role="status" aria-live="polite" aria-label="Notifications">
        {polite.map((record) => <ToastItem key={record.id} record={record} />)}
      </div>
      <div className="ui-toast-region" role="alert" aria-live="assertive" aria-label="Errors">
        {assertive.map((record) => <ToastItem key={record.id} record={record} />)}
      </div>
    </>
  );
}
