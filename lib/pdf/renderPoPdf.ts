import "server-only";

import { fetchPoData } from "./fetchPoData";
import { createPoDocument } from "./generator";
import type { PoData } from "./types";

export interface RenderedPoPdf {
  buffer: Buffer;
  filename: string;
  poData: PoData;
}

/**
 * Fetches a PO and renders its PDF in-process, returning the buffer + a safe
 * filename. Shared by the download route and the PO-issued email sender so
 * both produce an identical document. Returns null when the PO is not found.
 */
export async function renderPoPdf(poId: string): Promise<RenderedPoPdf | null> {
  const poData = await fetchPoData(poId);
  if (!poData) return null;

  const buffer = await createPoDocument(poData);
  const filename = `${poData.po_number.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

  return { buffer, filename, poData };
}
