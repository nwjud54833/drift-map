"use client";

import { ArrowRight, X } from "lucide-react";
import type { WorkbenchMode } from "./app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status";

export interface OnboardingProps {
  mode: WorkbenchMode;
  onImport: (side: "before" | "after") => void;
  onLoadSample: () => void;
  onDismiss: () => void;
}

const STEPS = [
  { number: "01", title: "Add a baseline", text: "Import the payload or OpenAPI 3.0 document that consumers rely on today." },
  { number: "02", title: "Add a candidate", text: "Import the version you are about to ship. JSON samples or a specification both work." },
  { number: "03", title: "Review classified drift", text: "Filter by severity, search by path, and read the rule behind each finding before you decide." },
];

/**
 * First-run guide shown when no comparison is configured. Dismissal is stored
 * by the caller in localStorage with a safe fallback, so it returns if storage
 * is unavailable.
 */
export function Onboarding({ mode, onImport, onLoadSample, onDismiss }: OnboardingProps) {
  return (
    <Card as="section" radius="panel" className="ca-onboarding" aria-labelledby="ca-onboarding-heading">
      <CardHeader className="ui-card-header-static">
        <div>
          <span className="ca-overline">First run</span>
          <h2 id="ca-onboarding-heading">Compare two contract versions in three steps</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          <X size={13} aria-hidden="true" /> Dismiss guide
        </Button>
      </CardHeader>

      <div className="ca-pane-body ca-onboarding-body">
        <ol className="ca-onboarding-steps">
          {STEPS.map((step) => (
            <li key={step.number}>
              <b aria-hidden="true">{step.number}</b>
              <span>
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="ca-onboarding-actions">
          <Button variant="primary" onClick={() => onImport("before")}>Import baseline</Button>
          <Button onClick={() => onImport("after")}>Import candidate</Button>
          <Button variant="quiet" onClick={onLoadSample}>Load sample pair</Button>
        </div>

        <p className="ca-onboarding-note">
          The bundled sample pair is a webhook payload migration: it shows a removed field, a required field that appeared, and
          a nested object that was restructured.
        </p>
      </div>

      <div className="ca-onboarding-note ca-onboarding-mode">
        <StatusPill mode={mode}>{mode === "cloud" ? "Cloud mode: snapshots are saved to your account" : "Local mode: data stays in this browser"}</StatusPill>
        <span>
          {mode === "cloud"
            ? "Local browser data is not uploaded and is not merged into cloud workspaces."
            : "Nothing is uploaded. Switching to cloud does not migrate local data — there is no automatic sync."}
          <span className="ca-onboarding-arrow"><ArrowRight size={12} aria-hidden="true" /> Read about storage modes in the footer.</span>
        </span>
      </div>
    </Card>
  );
}

/** Whether the first-run guide has been dismissed. Absent storage ⇒ show it. */
export function readOnboardingDismissed(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  try {
    return storage?.getItem("driftmap.workbench.onboarding") === "dismissed";
  } catch {
    return false;
  }
}

export function writeOnboardingDismissed(storage: Pick<Storage, "setItem"> | null | undefined): void {
  try {
    storage?.setItem("driftmap.workbench.onboarding", "dismissed");
  } catch {
    // Preference storage is optional; the guide simply reappears next time.
  }
}
