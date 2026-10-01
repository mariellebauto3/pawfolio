import type { KeyboardEvent as ReactKeyboardEvent } from "react";

// Keyboard focus helpers shared by the dialog frame and the dropdown menu.

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "iframe",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Elements inside `root` that Tab can reach, in DOM order. Skips hidden ones, and unchecked radios when their group
 * has a checked one (browsers tab to the checked radio only).
 */
export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.closest("[hidden], [inert]") || el.getClientRects().length === 0) return false;
    if (el instanceof HTMLInputElement && el.type === "radio" && el.name && !el.checked) {
      const group = root.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(el.name)}"]`);
      return !Array.from(group).some((radio) => radio.checked);
    }
    return true;
  });
}

/** Keeps Tab and Shift+Tab cycling inside `root`. Call from a keydown handler; returns true when it moved focus. */
export function trapTab(event: KeyboardEvent | ReactKeyboardEvent, root: HTMLElement): boolean {
  if (event.key !== "Tab") return false;
  const items = getFocusable(root);
  if (items.length === 0) {
    event.preventDefault();
    return true;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const outside = !active || !root.contains(active) || active === root;

  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}
