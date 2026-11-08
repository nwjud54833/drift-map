import { ImageResponse } from "next/og";

export const alt = "DriftMap semantic API contract review: breaking, warning, safe, and info";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const tiers = [
    { title: "BREAKING", color: "#fb7185", detail: "Contract removed or narrowed" },
    { title: "WARNING", color: "#fbbf24", detail: "Compatibility needs review" },
    { title: "SAFE", color: "#34d399", detail: "Additive change" },
    { title: "INFO", color: "#38bdf8", detail: "No semantic drift" },
  ];

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 62, color: "#f4f4f6", background: "#07070a", fontFamily: "Arial, sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", backgroundImage: "radial-gradient(circle at 80% 20%, rgba(56,189,248,.11), transparent 35%), linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)", backgroundSize: "auto, 42px 42px, 42px 42px" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
        <div style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #f4f4f6", borderRadius: 10, color: "#38bdf8", fontSize: 22, fontWeight: 700 }}>D</div>
        <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: 2 }}>DRIFTMAP</div>
        <div style={{ marginLeft: 12, borderLeft: "1px solid #383841", paddingLeft: 14, color: "#888994", fontSize: 16 }}>API CONTRACT REVIEW</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", position: "relative", marginTop: 18 }}>
        <div style={{ display: "flex", fontSize: 62, lineHeight: 1.08, fontWeight: 700, letterSpacing: -2 }}>Catch breaking API drift.</div>
        <div style={{ display: "flex", marginTop: 16, color: "#a1a1aa", fontSize: 25 }}>Review every contract change before production.</div>
      </div>
      <div style={{ display: "flex", gap: 14, position: "relative" }}>
        {tiers.map((tier) => (
          <div key={tier.title} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, padding: "19px 20px", background: "rgba(255,255,255,.035)", border: `1px solid ${tier.color}55`, borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, color: tier.color, fontSize: 17, fontWeight: 700, letterSpacing: 1 }}>
              <span style={{ width: 9, height: 9, display: "flex", borderRadius: 9, background: tier.color }} />{tier.title}
            </div>
            <div style={{ display: "flex", color: "#b8b8c1", fontSize: 14 }}>{tier.detail}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", position: "relative", color: "#696a75", fontSize: 15 }}>
        <span>OpenAPI · JSON samples · GitHub Actions</span>
        <span>driftmap.in</span>
      </div>
    </div>,
    { ...size },
  );
}
