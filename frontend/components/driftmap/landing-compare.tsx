"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OLD_RESPONSE = `{
  "id": 101,
  "email": "user@example.com",
  "status": "active"
}`;
const NEW_RESPONSE = `{
  "id": 101,
  "status": "active"
}`;

export function CompareSection() {
  const [showNew, setShowNew] = useState(true);
  const router = useRouter();
  return (
    <section id="comparison" className="py-16 md:py-24 border-b border-white/[0.07]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-sky-300 mb-3">A real example</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Spot the change that can break a client</h2>
          <p className="mt-3 text-sm sm:text-base text-[#A5A6B0] leading-relaxed">Compare two versions of an API response. DriftMap shows what disappeared and why it matters.</p>
        </div>
        <div className="grid lg:grid-cols-[1fr_1fr_0.85fr] gap-4 items-stretch">
          <ResponseCard title="Old response" code={OLD_RESPONSE} />
          <div className="relative">
            <ResponseCard title="New response" code={showNew ? NEW_RESPONSE : OLD_RESPONSE} />
            <button type="button" onClick={() => setShowNew((current) => !current)} aria-pressed={showNew} className="mt-2 text-xs text-sky-300 hover:text-white underline underline-offset-4">{showNew ? "Show unchanged version" : "Show removed field"}</button>
          </div>
          <aside className="rounded-2xl border border-rose-400/25 bg-rose-400/[0.06] p-5 flex flex-col">
            <span className="inline-flex self-start items-center gap-2 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-300"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />Breaking change</span>
            {showNew ? <><h3 className="mt-5 text-lg font-semibold text-white"><code className="text-rose-300">email</code> was removed</h3><p className="mt-2 text-sm text-[#B7B8C0] leading-relaxed">Existing clients that expect <code className="text-white">email</code> may fail when they read this response.</p><p className="mt-4 pt-4 border-t border-white/[0.08] text-sm text-[#D7D7DD]"><span className="text-[#858691]">Suggested action:</span> Restore the field or update consumers.</p></> : <><h3 className="mt-5 text-lg font-semibold text-white">No field was removed</h3><p className="mt-2 text-sm text-[#B7B8C0] leading-relaxed">Switch back to the new response to see the breaking change.</p></>}
            <button type="button" onClick={() => router.push("/workbench?sample=1")} className="mt-auto pt-5 text-left text-sm font-medium text-sky-300 hover:text-white">Try this comparison <span aria-hidden="true">→</span></button>
          </aside>
        </div>
        <p className="mt-4 text-[11px] text-[#777985]">Change labels are heuristic guidance based on the responses or API documents you provide, not a guarantee of runtime behavior.</p>
      </div>
    </section>
  );
}

function ResponseCard({ title, code }: { title: string; code: string }) {
  return <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#09090C]"><div className="flex items-center gap-2 border-b border-white/[0.08] bg-white/[0.025] px-4 py-3 text-xs font-medium text-[#B7B8C0]"><span className="h-2 w-2 rounded-full bg-[#5E606E]" />{title}</div><pre className="overflow-x-auto p-4 sm:p-5 text-xs sm:text-sm leading-6 text-[#D7D7DD]"><code>{code}</code></pre></div>;
}
