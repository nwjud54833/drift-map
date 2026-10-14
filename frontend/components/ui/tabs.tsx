import { useRef } from "react";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string> {
  label: string;
  value: T;
  items: readonly TabItem<T>[];
  onChange: (value: T) => void;
  /** id prefix so panels can point back at their tab with aria-labelledby. */
  idPrefix: string;
  className?: string;
}

/**
 * Tab list with automatic activation and arrow-key movement. The associated
 * panels are rendered by the caller; each one should use
 * `role="tabpanel"`, `aria-labelledby={`${idPrefix}-tab-${value}`}`,
 * `id={`${idPrefix}-panel-${value}`}` and `hidden` while inactive.
 */
export function Tabs<T extends string>({ label, value, items, onChange, idPrefix, className }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const keys = items.map((item) => item.value);
    const index = keys.indexOf(value);
    let next: T | undefined;
    if (event.key === "ArrowRight") next = keys[(index + 1) % keys.length];
    else if (event.key === "ArrowLeft") next = keys[(index - 1 + keys.length) % keys.length];
    else if (event.key === "Home") next = keys[0];
    else if (event.key === "End") next = keys[keys.length - 1];
    if (next === undefined) return;
    event.preventDefault();
    onChange(next);
    listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${idPrefix}-tab-${next}`)}`)?.focus();
  }

  return (
    <div ref={listRef} className={["ui-tabs", className ?? ""].filter(Boolean).join(" ")} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            id={`${idPrefix}-tab-${item.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
          >
            {item.label}
            {item.count !== undefined && <span className="ui-tabs-count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
