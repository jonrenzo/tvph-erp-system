/** Default rows per page for list views. */
export const LIST_PAGE_SIZE = 25;

/** Parse a 1-based page from a search param, clamped to >= 1. */
export function parsePage(value: unknown): number {
  const n = parseInt(String(value ?? "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Supabase .range() bounds for a 1-based page. */
export function pageRange(page: number, pageSize: number): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}
