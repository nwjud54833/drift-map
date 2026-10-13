"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { choice, setTheme } = useTheme();
  return (
    <div role="group" aria-label="Theme" style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", overflow: "hidden" }}>
      {([
        ["system", Monitor, "System"],
        ["light", Sun, "Light"],
        ["dark", Moon, "Dark"],
      ] as const).map(([value, Icon, label]) => (
        <button
          key={value}
          aria-pressed={choice === value}
          aria-label={`Theme: ${label}`}
          onClick={() => setTheme(value)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, minHeight: 30, padding: "0 9px",
            border: 0, background: choice === value ? "var(--surface-raised)" : "var(--surface)",
            color: choice === value ? "var(--text-primary)" : "var(--text-muted)",
            fontSize: 11, fontWeight: 600, cursor: "pointer",
            boxShadow: choice === value ? "inset 0 -2px var(--accent)" : "none",
          }}
        >
          <Icon size={13} aria-hidden="true" />{label}
        </button>
      ))}
    </div>
  );
}
