import "server-only";

import { resolvePoDocx } from "@/lib/docx/resolvePoDocx";
import { convertDocxToPdf } from "./convertDocxToPdf";

export interface RenderedPoPdf {
  buffer: Buffer;
  filename: string;
}

export async function renderPoPdf(poId: string): Promise<RenderedPoPdf> {
  const docx = await resolvePoDocx(poId);
  const buffer = await convertDocxToPdf(docx.buffer, docx.filename);
  return { buffer, filename: docx.filename.replace(/\.docx$/i, ".pdf") };
}
