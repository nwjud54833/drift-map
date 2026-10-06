"use client";

import { useHealth } from "@/lib/useHealth";

function StatusCell({ label, state }: { label: string; state: string | undefined }) {
  const tone = state === "ok" ? "" : "is-idle";
  return (
    <span className="status-cell" title={`${label}: ${state ?? "unknown"}`}>
      <span className={`status-dot ${tone}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export default function StatusBar() {
  const { data, isError } = useHealth();
  const backendState = isError ? "unreachable" : (data?.status ?? "checking…");

  return (
    <footer className="status-bar" aria-label="Service status">
      <div className="status-inner">
        <StatusCell label={`Backend ${backendState}`} state={isError ? undefined : data?.status} />
        {data?.components && (
          <>
            <StatusCell label="Database" state={data.components.db} />
            <StatusCell label="Redis" state={data.components.redis} />
            <StatusCell label="AI provider" state={data.components.llm} />
          </>
        )}
        {data && <span className="status-version">v{data.version}</span>}
      </div>
    </footer>
  );
}
