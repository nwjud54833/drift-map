"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const fieldClass = "mt-2 w-full rounded-xl border border-white/10 bg-[#0b0c12] px-4 py-3 text-sm text-[#f0eee8] outline-none transition focus:border-[#a78bfa] focus:ring-2 focus:ring-[#a78bfa]/20";

export function OnboardingSurveyForm() {
  const router = useRouter();
  const [companySize, setCompanySize] = useState("");
  const [primaryApiType, setPrimaryApiType] = useState("");
  const [cicdTool, setCicdTool] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/v1/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companySize, primaryApiType, cicdTool }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || "Your answers could not be saved. Please try again.");
      }
      setSaved(true);
      router.replace("/workbench");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your answers could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090d] px-5 py-16 text-[#f0eee8] sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(125,87,255,0.14),transparent_58%)]" />
      <section className="relative mx-auto max-w-xl rounded-3xl border border-white/10 bg-[#101117]/90 p-7 shadow-2xl shadow-black/30 sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#a78bfa]">DriftMap · quick setup</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Make your contract reviews fit your team.</h1>
        <p className="mt-3 text-sm leading-6 text-[#a6a5b1]">Three quick answers help us tailor onboarding. Your responses are used as aggregated product research and can be updated later.</p>

        <form className="mt-8 space-y-6" onSubmit={submit}>
          <label className="block text-sm font-medium" htmlFor="company-size">
            Company size
            <select className={fieldClass} id="company-size" required value={companySize} onChange={(event) => setCompanySize(event.target.value)}>
              <option value="" disabled>Select team size</option>
              <option value="solo">Just me</option>
              <option value="2-10">2–10 people</option>
              <option value="11-50">11–50 people</option>
              <option value="51-200">51–200 people</option>
              <option value="201-1000">201–1,000 people</option>
              <option value="1000+">More than 1,000 people</option>
            </select>
          </label>
          <label className="block text-sm font-medium" htmlFor="primary-api-type">
            Primary API type
            <select className={fieldClass} id="primary-api-type" required value={primaryApiType} onChange={(event) => setPrimaryApiType(event.target.value)}>
              <option value="" disabled>Select API type</option>
              <option value="rest">REST / JSON</option>
              <option value="graphql">GraphQL</option>
              <option value="grpc">gRPC</option>
              <option value="event-driven">Events / webhooks</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block text-sm font-medium" htmlFor="cicd-tool">
            CI/CD tool
            <select className={fieldClass} id="cicd-tool" required value={cicdTool} onChange={(event) => setCicdTool(event.target.value)}>
              <option value="" disabled>Select your CI/CD tool</option>
              <option value="github-actions">GitHub Actions</option>
              <option value="gitlab-ci">GitLab CI</option>
              <option value="circleci">CircleCI</option>
              <option value="jenkins">Jenkins</option>
              <option value="azure-devops">Azure DevOps</option>
              <option value="other">Other / not using CI yet</option>
            </select>
          </label>

          {error && <p className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200" role="alert">{error}</p>}
          {saved && <p className="text-sm text-emerald-300" role="status">Saved. Opening your Workbench…</p>}
          <button className="w-full rounded-xl bg-[#a78bfa] px-5 py-3.5 text-sm font-semibold text-[#171321] transition hover:bg-[#b9a3ff] disabled:cursor-wait disabled:opacity-60" disabled={saving} type="submit">
            {saving ? "Saving…" : "Continue to Workbench"}
          </button>
        </form>
      </section>
    </main>
  );
}
