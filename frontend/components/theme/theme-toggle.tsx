"use client";

import { useRef } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeChoice } from "./theme-provider";

interface Option {
  value: ThemeChoice;
  label: string;
  Icon: typeof Sun;
}

const OPTIONS: readonly Option[] = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

/**
 * Three-state theme control: System (default), Light, Dark.
 *
 * Implemented as a radio group rather than a set of independent toggles, because
 * the three choices are mutually exclusive. Follows the WAI-ARIA radio-group
 * pattern: one tab stop, arrow keys move and select, Home/End jump to the ends.
 */
export function ThemeToggle() {
  const { choice, setTheme } = useTheme();
  const groupRef = useRef<HTMLDivElement>(null);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = OPTIONS.findIndex((option) => option.value === choice);
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % OPTIONS.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + OPTIONS.length) % OPTIONS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = OPTIONS.length - 1;
    if (next === null) return;
    event.preventDefault();
    const value = OPTIONS[next].value;
    setTheme(value);
    groupRef.current?.querySelector<HTMLElement>(`#theme-option-${value}`)?.focus();
  }

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Colour theme" ref={groupRef} onKeyDown={onKeyDown}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = choice === value;
        return (
          <button
            key={value}
            id={`theme-option-${value}`}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            title={`${label} theme`}
            onClick={() => setTheme(value)}
          >
            <Icon size={13} aria-hidden="true" />
            <span className="theme-toggle-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
