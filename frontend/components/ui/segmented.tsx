import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Replaces the visible label as the accessible name when it is abbreviated. */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  block?: boolean;
  className?: string;
}

/**
 * Segmented control. Uses `aria-pressed` buttons rather than radio roles
 * because each segment is an independent toggle target in the toolbar, and the
 * group carries the accessible name.
 */
export function Segmented<T extends string>({ label, value, options, onChange, block = false, className }: SegmentedProps<T>) {
  return (
    <div className={["ui-segmented", block ? "ui-segmented-block" : "", className ?? ""].filter(Boolean).join(" ")} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          aria-label={option.ariaLabel}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
