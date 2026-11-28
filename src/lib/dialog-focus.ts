import type { KeyboardEvent } from "react";

/** Native modal inertness plus explicit keyboard wrapping (no browser-chrome stop). */
export function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"],iframe,video[controls]',
    ),
  ).filter(
    (item) =>
      item.getClientRects().length > 0 &&
      getComputedStyle(item).visibility !== "hidden",
  );
  const first = items[0],
    last = items.at(-1);
  if (!first) {
    event.preventDefault();
    event.currentTarget.focus();
    return;
  }
  if (
    event.shiftKey &&
    (document.activeElement === first ||
      document.activeElement === event.currentTarget)
  ) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
