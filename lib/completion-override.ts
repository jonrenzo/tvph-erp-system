"use client";

/**
 * TEMPORARY client-side completion-% override (testing only).
 *
 * The `projects.completion_pct` column does not exist in the DB yet, so this
 * stores the manual completion % in localStorage instead of persisting it.
 * Both the project detail page and the dashboard Project Progress list read
 * from here. Remove this once the real column/migration lands and wire the
 * value back through the server again.
 */

const PREFIX = "tvph:completion_pct_override:";
const EVENT = "completion-pct-override-changed";

export function getCompletionOverride(projectId: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PREFIX + projectId);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function setCompletionOverride(projectId: string, pct: number | null) {
  if (typeof window === "undefined") return;
  if (pct === null) window.localStorage.removeItem(PREFIX + projectId);
  else window.localStorage.setItem(PREFIX + projectId, String(pct));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Subscribe to override changes (same tab via custom event, other tabs via storage). */
export function onCompletionOverrideChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
