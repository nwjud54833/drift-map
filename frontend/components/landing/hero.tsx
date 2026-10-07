"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import fixture from "@/fixtures/order-shipped.fixture.json";
import { compareContracts } from "@/lib/contract/compare";
import { inferContract } from "@/lib/contract/infer";
import type { ContractChange, ContractSnapshot, PayloadSample } from "@/lib/contract/types";
import { GITHUB_URL } from "./ui";

const stamp = "2026-10-07T00:00:00.000Z";
function makeSnapshot(id: string, values: readonly unknown[], label: string): ContractSnapshot {
  const samples: PayloadSample[] = values.map((entry, index) => {
    const value = entry as PayloadSample["value"];
    const data = value.data && typeof value.data === "object" && !Array.isArray(value.data) ? value.data : {};
    return { id: `${id}_${index}`, label: typeof data.order_id === "string" ? data.order_id : `Sample ${index + 1}`, source: "fixture", capturedAt: stamp, value };
  });
  return { id, workspaceId: "landing-demo", versionLabel: label, notes: "", sourceFileName: null, samples, contract: inferContract(samples, stamp), createdAt: stamp };
}
const baseline = makeSnapshot("landing-v1", fixture.baseline, "2026-09 baseline");
const candidate = makeSnapshot("landing-v2", fixture.candidate, "2026-10 candidate");
const allChanges = compareContracts(baseline.contract, candidate.contract, "event");
const demoPaths = ["/data/customer/email", "/data/total_cents", "/data/shipping/tracking_number", "/data/fulfillment"];
const changes = demoPaths.map((path) => allChanges.find((change) => change.pointer === path)).filter((change): change is ContractChange => Boolean(change));
const severityLabels: Record<ContractChange["severity"], string> = { breaking: "BREAKING", warning: "WARNING", safe: "SAFE", info: "INFO" };

type PreviewNode = ContractSnapshot["contract"]["nodes"][number];
function PreviewRow({ path, node, selected, missing, severity, onClick }: { path: string; node: PreviewNode | undefined; selected: boolean; missing: boolean; severity?: ContractChange["severity"]; onClick: () => void }) {
  return <button className={`preview-path ${selected ? "is-selected" : ""} ${missing ? "is-missing" : ""} ${severity ? `is-${severity}` : ""}`} onClick={onClick}><span className="preview-node-mark" aria-hidden="true">{missing ? "·" : "↳"}</span><code>{path}</code><span className="preview-type">{node ? node.kinds.join(" | ") : "missing"}</span></button>;
}

export function Hero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const activeChange = changes[activeIndex] ?? changes[0];
  const beforeNodes = useMemo(() => new Map(baseline.contract.nodes.map((node) => [node.pointer, node])), []);
  const afterNodes = useMemo(() => new Map(candidate.contract.nodes.map((node) => [node.pointer, node])), []);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches || changes.length < 2) return;
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % changes.length), 4800);
    return () => window.clearInterval(timer);
  }, [paused]);
  const select = (index: number) => setActiveIndex(index);
  const candidatePath = activeChange?.pointer === "/data/customer/email" ? "/data/customer/email" : activeChange?.pointer === "/data/total_cents" ? "/data/total" : activeChange?.pointer === "/data/shipping/tracking_number" ? "/data/shipping/tracking" : activeChange?.pointer;
  const baselinePath = activeChange?.pointer === "/data/fulfillment" ? "/data/fulfillment" : activeChange?.pointer;
  return <section className="hero" id="product"><div className="hero-map" aria-hidden="true"><span className="map-route route-one"/><span className="map-route route-two"/><i className="map-point point-a"/><i className="map-point point-b"/><i className="map-point point-c"/></div><div className="hero-light" aria-hidden="true"/>
    <div className="hero-inner"><div className="hero-copy"><span className="hero-badge"><span className="live-dot"/>LOCAL-FIRST <i/> DEVELOPER TOOL</span><h1>Catch <em>contract drift</em><br className="desktop-break"/> before it breaks your integration.</h1><p>Compare real JSON payloads, infer their structure, and see the changes that could break your API, webhook, or structured-output consumer.</p><div className="hero-actions"><Link className="button-primary" href="/workbench">Try Contract Atlas <ArrowRight size={16}/></Link><a className="button-quiet" href={GITHUB_URL} target="_blank" rel="noreferrer">View on GitHub <ArrowUpRight size={15}/></a></div><div className="hero-privacy"><span><LockKeyhole size={13}/>Runs locally in your browser</span><i/><span>No API key</span><i/><span>No data uploaded</span></div></div>
      <div className="hero-preview-wrap" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}><div className="preview-caption"><span><Sparkles size={13}/> A payload migration, mapped</span><span className="preview-samples">3 samples per version <i/></span></div><div className="hero-preview"><div className="preview-topbar"><div className="preview-title"><span className="atlas-glyph">CA</span><div><strong>Order Webhook Migration</strong><small>order.shipped <span>·</span> event contract</small></div></div><div className="preview-state"><span className="live-dot"/>LOCAL ANALYSIS</div></div><div className="preview-grid"><section className="preview-pane"><header><span>01 / BASELINE</span><b>2026-09</b></header><div className="preview-rows">{["/data/order_id", "/data/status", "/data/total_cents", "/data/customer/email", "/data/shipping/tracking_number", "/data/fulfillment"].map((path) => { const change = changes.find((item) => item.pointer === path); return <PreviewRow key={path} path={path} node={beforeNodes.get(path)} selected={activeChange?.pointer === path || (activeChange?.pointer.startsWith(`${path}/`) ?? false)} missing={path === "/data/fulfillment" && activeChange?.kind === "field-added"} severity={change?.severity ?? (baselinePath === path ? activeChange?.severity : undefined)} onClick={() => { const index = changes.findIndex((item) => item.pointer === path); if (index >= 0) select(index); }}/>; })}</div><div className="preview-footnote">paths inferred from 3 payloads</div></section><div className="preview-drift"><header><span>02 / SEMANTIC DRIFT</span><b>{allChanges.length} changes</b></header><div className="preview-change-list">{changes.map((change, index) => <button key={change.id} onClick={() => select(index)} className={`preview-change ${activeIndex === index ? "is-active" : ""} severity-${change.severity}`} aria-pressed={activeIndex === index}><span className="severity-marker"/><div><span className="change-severity">{severityLabels[change.severity]} <i>·</i> {change.title.toUpperCase()}</span><code>{change.pointer}</code></div><ArrowRight size={13}/></button>)}</div><div className="preview-compat"><ShieldCheck size={13}/> Direction-aware compatibility</div></div><section className="preview-pane preview-candidate"><header><span>03 / CANDIDATE</span><b>2026-10</b></header><div className="preview-rows">{["/data/order_id", "/data/status", "/data/total", "/data/customer", "/data/customer/email", "/data/shipping/tracking", "/data/fulfillment"].map((path) => { const selected = candidatePath === path || (candidatePath?.startsWith(`${path}/`) ?? false); const change = changes.find((item) => item.pointer === path); return <PreviewRow key={path} path={path} node={afterNodes.get(path)} selected={selected} missing={path === "/data/customer/email" && activeChange?.pointer === path} severity={change?.severity ?? (selected ? activeChange?.severity : undefined)} onClick={() => { const index = changes.findIndex((item) => item.pointer === path); if (index >= 0) select(index); }}/>; })}</div><div className="preview-footnote">new shape, made legible</div></section></div><div className="preview-inspector"><span className={`inspector-state severity-${activeChange?.severity}`}><i/>{severityLabels[activeChange?.severity ?? "info"]}</span><code>{activeChange?.pointer}</code><strong>{activeChange?.title}</strong><span>{activeChange?.before?.kinds.join(" | ") ?? "missing"} <b>→</b> {activeChange?.after?.kinds.join(" | ") ?? "missing"}</span><p>{activeChange?.explanation}</p></div></div><div className="preview-pagination" aria-label="Demo changes">{changes.map((change, index) => <button type="button" key={change.id} className={activeIndex === index ? "active" : ""} onClick={() => select(index)} aria-label={`Show ${change.pointer}`} aria-pressed={activeIndex === index}/>)}</div></div>
    </div></section>;
}
