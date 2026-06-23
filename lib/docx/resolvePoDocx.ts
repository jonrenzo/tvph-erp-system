import "server-only";

import { createClient } from "@/utils/supabase/server";
import { generatePurchaseOrderDocx } from "./generator";

export async function resolvePoDocx(
  poId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const supabase = await createClient();

  const { data: artifact } = await supabase
    .from("purchase_order_artifacts")
    .select("storage_path")
    .eq("po_id", poId)
    .eq("artifact_type", "docx")
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();

  let buffer: Buffer;

  if (artifact?.storage_path) {
    const { data: fileData, error } = await supabase.storage
      .from("po-artifacts")
      .download(artifact.storage_path);

    if (error || !fileData) throw new Error("Failed to download stored DOCX");
    buffer = Buffer.from(await fileData.arrayBuffer());
  } else {
    buffer = await generatePurchaseOrderDocx(poId);
  }

  const filename = `PO_${poId.split("-")[0].toUpperCase()}.docx`;
  return { buffer, filename };
}
