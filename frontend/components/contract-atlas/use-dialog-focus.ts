"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Modal focus management.
 *
 * On open: remembers the previously focused element, then moves focus into the
 * dialog. While open: Tab and Shift+Tab cycle within the dialog, so focus cannot
 * escape behind it. On close: Escape invokes `onClose`, and focus returns to
 * whatever was focused before the dialog opened.
 *
 * The captured element is held in a ref so that re-renders of the parent cannot
 * replace it with a node that is already inside the dialog.
 */
export function useDialogFocus<T extends HTMLElement>(ref: RefObject<T | null>, open: boolean, onClose: () => void) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const dialogElement = ref.current;
    if (!dialogElement) return;
    const dialog = dialogElement as T;

    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");

    focusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === firstItem || !dialog.contains(document.activeElement))) {
        event.preventDefault(); lastItem.focus();
      } else if (!event.shiftKey && (document.activeElement === lastItem || !dialog.contains(document.activeElement))) {
        event.preventDefault(); firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const target = previouslyFocused.current;
      if (target?.isConnected) target.focus();
      previouslyFocused.current = null;
    };
  }, [open, onClose, ref]);
}
