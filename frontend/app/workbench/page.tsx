import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkbenchPage } from "@/components/driftmap/workbench-page";

export const metadata: Metadata = {
  title: "Workbench · DriftMap",
  description: "Compare real JSON payloads or OpenAPI 3.0 contracts, infer the structural contract, and inspect classified semantic drift.",
};

export default function WorkbenchRoute() {
  return (
    // `WorkbenchPage` reads `?view=graph` through `useSearchParams`, which needs a
    // Suspense boundary so the shell can stream before the query resolves.
    <Suspense fallback={<WorkbenchLoading />}>
      <WorkbenchPage />
    </Suspense>
  );
}

function WorkbenchLoading() {
  return (
    <main id="view-workbench" className="relative z-10 flex-1 grid place-items-center p-16" aria-busy="true">
      <p className="font-mono text-xs text-[#5E606E]" role="status" aria-live="polite">Opening the workbench…</p>
    </main>
  );
}
