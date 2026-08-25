"use server";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { stampPdfWithSignature } from "@/utils/pdf-stamper";
import { extractDocumentMetadata } from "@/app/actions/ocr";
import { createNotification, createNotificationForRoles } from "@/utils/notifications";
import { revalidatePath } from "next/cache";
import { combineImagesToPdf } from "@/lib/pdf/combineImagesToPdf";
import { sendPoSignedReceivedEmail } from "@/lib/email/po-signed-received";

// ponytail: defer via next/server after() without breaking jest (which lacks Request)
function defer(fn: () => Promise<void>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { after } = require("next/server") as { after: (f: () => void) => void };
    after(fn);
  } catch {
    void fn();
  }
}

async function findValidMagicLink(supabase: Awaited<ReturnType<typeof createServiceRoleClient>>, token: string) {
  return supabase
    .from("magic_links")
    .select("*")
    .eq("token", token)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
}

/**
 * Validates a magic link minted for the PO signature portal (entity_type 'po')
 * and returns the PO, vendor, and any prior signature. Vendors may come back
 * to re-sign later, so this works regardless of the PO's current status.
 */
export async function validatePoPortalToken(token: string) {
  const supabase = createServiceRoleClient();
  const { data: magicLink, error } = await findValidMagicLink(supabase, token);

  if (error || !magicLink) {
    return { error: "Invalid or expired access token." };
  }
  if (magicLink.entity_type !== "po") {
    return { error: "This link is not a purchase order signature link." };
  }

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, po_number, amount, currency, status, issued_date, sent_at, signed_at, vendors ( name, contact_person )")
    .eq("id", magicLink.entity_id)
    .single();

  if (!po) {
    return { error: "Purchase order not found." };
  }

  const vendor = (po.vendors ?? {}) as { name?: string; contact_person?: string | null };

  const { data: signature } = await supabase
    .from("po_signatures")
    .select("signer_name, signer_title, ip_address, signed_at, signed_file_url, signed_file_name")
    .eq("po_id", po.id)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (signature?.signed_file_url) {
    const path = signature.signed_file_url.split("/object/public/po-artifacts/")[1];
    if (path) {
      const { data: signed } = await supabase.storage
        .from("po-artifacts")
        .createSignedUrls([path], 3600);
      if (signed?.[0]?.signedUrl) {
        (signature as any).signed_file_url = signed[0].signedUrl;
      }
    }
  }

  return {
    success: true,
    po,
    vendor,
    alreadySigned: !!signature?.signed_at,
    signature,
  };
}

/**
 * Records a vendor e-signature for a PO: uploads the executed PDF to
 * po-artifacts, inserts a po_signatures row (with the file URL), moves the PO
 * to 'signed_received' awaiting requisitioner review, and emails the
 * requestor. Idempotent —
 * re-signing replaces the latest signature. Anonymous portal access uses the
 * service-role client, so recordAuditLog (user-scoped) is skipped here; the
 * po_signatures row IS the audit trail.
 */
export async function signPortalPO(
  token: string,
  signerName: string,
  signerTitle: string,
  ipAddress: string,
  files: File | File[],
) {
  const name = signerName.trim();
  if (!name) return { error: "Please enter your full name to sign." };

  const fileList = (Array.isArray(files) ? files : files ? [files] : []).filter(Boolean) as File[];
  if (fileList.length === 0) {
    return { error: "Please upload the signed purchase order PDF or up to 3 images to complete signing." };
  }

  const ALLOWED_IMAGE = new Set(["image/jpeg", "image/jpg", "image/png"]);
  const pdfs = fileList.filter((f) => f.type === "application/pdf");
  const images = fileList.filter((f) => ALLOWED_IMAGE.has(f.type));
  const unsupported = fileList.filter((f) => f.type !== "application/pdf" && !ALLOWED_IMAGE.has(f.type));
  if (unsupported.length > 0) {
    return { error: "Only PDF or JPEG/PNG images are accepted for the signed purchase order." };
  }
  if (pdfs.length > 0 && images.length > 0) {
    return { error: "Please upload either a single PDF or up to 3 images, not both." };
  }
  if (pdfs.length > 1) {
    return { error: "Only a single PDF file is accepted." };
  }
  if (images.length > 3) {
    return { error: "Up to 3 images are accepted. Please combine additional pages into the same images." };
  }
  if (images.length === 0 && pdfs.length === 0) {
    return { error: "Only PDF or JPEG/PNG images are accepted for the signed purchase order." };
  }

  // Build the final PDF buffer to store (single PDF as-is, or 1–3 images combined into one PDF
  // so every downstream viewer keeps working against a single signed_file_url).
  let fileBuffer: Buffer;
  let fileName: string;
  let displayName: string;
  if (pdfs.length === 1) {
    const pdfFile = pdfs[0];
    fileBuffer = Buffer.from(await pdfFile.arrayBuffer());
    fileName = pdfFile.name;
    displayName = fileName;
  } else {
    const imagePayloads = await Promise.all(
      images.map(async (f) => ({
        bytes: new Uint8Array(await f.arrayBuffer()),
        mimeType: f.type === "image/jpg" ? "image/jpeg" : f.type,
      })),
    );
    const pdfBytes = await combineImagesToPdf(imagePayloads);
    fileBuffer = Buffer.from(pdfBytes);
    fileName = `signed-PO-${Date.now()}.pdf`;
    displayName = images.map((f) => f.name).join(", ") || "signed-images.pdf";
  }

  const supabase = createServiceRoleClient();
  const { data: magicLink, error } = await findValidMagicLink(supabase, token);

  if (error || !magicLink) {
    return { error: "Invalid or expired access token." };
  }
  if (magicLink.entity_type !== "po") {
    return { error: "This link is not a purchase order signature link." };
  }

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, po_number, status, approval_requested_from, vendors ( name )")
    .eq("id", magicLink.entity_id)
    .single();

  if (!po) {
    return { error: "Purchase order not found." };
  }

  const vendor = (po.vendors ?? {}) as { name?: string };

  // Single-use: block re-upload without a fresh link from ERP.
  const { data: existingSig } = await supabase
    .from("po_signatures")
    .select("id")
    .eq("po_id", po.id)
    .limit(1)
    .maybeSingle();
  if (existingSig) {
    const graceExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await supabase.from("magic_links").update({ expires_at: graceExpiresAt }).eq("id", magicLink.id);
    return {
      error:
        "This purchase order has already been signed. This link has been retired. Please request a new link from your TelcoVantage contact if a correction is needed.",
    };
  }

  const filePath = `po/${po.id}/signed-${Date.now()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("po-artifacts")
    .upload(filePath, fileBuffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("po-artifacts").getPublicUrl(filePath);

  const now = new Date().toISOString();
  const { error: sigError } = await supabase.from("po_signatures").insert({
    po_id: po.id,
    signer_name: name,
    signer_title: signerTitle.trim() || null,
    ip_address: ipAddress,
    signed_at: now,
    signed_file_url: publicUrl,
    signed_file_name: displayName,
  });
  if (sigError) return { error: sigError.message };

  const { error: poError } = await supabase
    .from("purchase_orders")
    .update(
      {
        status: "signed_received",
        signed_doc_status: "pending_approval",
        signed_at: now,
        updated_at: now,
      },
      { count: "exact" },
    )
    .eq("id", po.id);
  if (poError) return { error: poError.message };

  // Notify the requestor that the signed copy arrived; never blocks the upload.
  defer(async () => {
    await sendPoSignedReceivedEmail(po.id);
  });

  // Keep success visible for ~15 mins so refresh still shows "This Purchase Order Has Been Signed"
  // instead of "Access Expired" (issue #115), then let the link expire naturally.
  const graceExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await supabase.from("magic_links").update({ expires_at: graceExpiresAt }).eq("id", magicLink.id);

  {
    const approvers = (po as any).approval_requested_from as string[] | null;
    if (approvers && approvers.length > 0) {
      await createNotification({
        type: "po",
        title: "✍️ PO Signed — Pending Review",
        message: `${vendor.name || "Vendor"} submitted a signed copy of purchase order ${po.po_number || ""} (${name}). Awaiting requisitioner approval.`,
        link: `/dashboard/purchase-orders/${po.id}`,
        created_by: null,
        recipientIds: approvers,
      });
    } else {
      await createNotificationForRoles({
        type: "po",
        title: "✍️ PO Signed — Pending Review",
        message: `${vendor.name || "Vendor"} submitted a signed copy of purchase order ${po.po_number || ""} (${name}). Awaiting requisitioner approval.`,
        link: `/dashboard/purchase-orders/${po.id}`,
        created_by: null,
        roles: ["operations"],
      });
    }
  }

  revalidatePath(`/dashboard/purchase-orders/${po.id}`);
  revalidatePath("/dashboard/purchase-orders");
  return { success: true, signedAt: now };
}

export async function validatePortalToken(token: string) {
  const supabase = createServiceRoleClient();
  const { data: magicLink, error } = await supabase
    .from("magic_links")
    .select("*")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !magicLink) {
    return { error: "Invalid or expired access token." };
  }

  if (magicLink.entity_type === "vendor") {
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id, name, contact_person, contact_email, status")
      .eq("id", magicLink.entity_id)
      .single();

    const { data: documents } = await supabase
      .from("vendor_documents")
      .select(`
        id, doc_type, status, expiry_date, file_name, file_url, notes,
        vendor_document_files(id, file_name, file_url, created_at)
      `)
      .eq("vendor_id", magicLink.entity_id)
      .is("archived_at", null);

    // Sign per-file URLs (bucket is private) — mirror PO pattern
    if (documents && documents.length > 0) {
      const entries: { file: any; path: string }[] = [];
      for (const doc of documents as any[]) {
        for (const f of (doc.vendor_document_files || [])) {
          if (!f.file_url) continue;
          const raw = f.file_url as string;
          const after = raw.split("/object/public/vendor-documents/")[1] ?? raw.split("/vendor-documents/")[1] ?? raw;
          const path = after.split("?")[0].replace(/^\/+/, "");
          if (path) entries.push({ file: f, path });
        }
      }
      if (entries.length > 0) {
        const paths = entries.map((e) => e.path);
        const { data: signed } = await supabase.storage.from("vendor-documents").createSignedUrls(paths, 3600);
        if (signed) {
          signed.forEach((s: any, idx: number) => {
            if (s?.signedUrl) entries[idx].file.file_url = s.signedUrl;
          });
        }
      }
    }

    return {
      success: true,
      entityType: "vendor",
      entity: vendor,
      documents: documents || [],
    };
  } else {
    const { data: customer } = await supabase
      .from("crm_accounts")
      .select("id, company_name")
      .eq("id", magicLink.entity_id)
      .single();

    const { data: documents } = await supabase
      .from("crm_documents")
      .select("id, doc_type, status, expiry_date, file_name, file_url, notes")
      .eq("account_id", magicLink.entity_id)
      .is("archived_at", null);

    return {
      success: true,
      entityType: "customer",
      entity: customer,
      documents: documents || [],
    };
  }
}

export async function uploadPortalDocument(
  token: string,
  docType: string,
  formData: FormData,
  ipAddress = "Unknown",
) {
  const supabase = createServiceRoleClient();
  
  // 1. Validate Token
  const { data: magicLink, error: tokenErr } = await supabase
    .from("magic_links")
    .select("*")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (tokenErr || !magicLink) {
    return { error: "Access token expired or invalid" };
  }

  const file = formData.get("file") as File;
  const signatureData = formData.get("signatureImage") as string | null;
  const expiryDate = formData.get("expiryDate") as string | null;
  const notes = formData.get("notes") as string | null;

  if (!file) return { error: "No file provided" };

  if (file.size > 50 * 1024 * 1024) {
    return { error: `File exceeds the 50MB limit.` };
  }

  let fileBuffer = await file.arrayBuffer();
  const fileName = file.name;
  const finalMimeType = file.type;

  // 2. Fetch Entity Name
  let entityName = "Unknown Entity";
  if (magicLink.entity_type === "vendor") {
    const { data: v } = await supabase.from("vendors").select("name").eq("id", magicLink.entity_id).single();
    if (v) entityName = v.name;
  } else {
    const { data: c } = await supabase.from("crm_accounts").select("company_name").eq("id", magicLink.entity_id).single();
    if (c) entityName = c.company_name;
  }

  // 3. E-Signature Stamping
  if (signatureData && finalMimeType === "application/pdf") {
    const signedBuffer = await stampPdfWithSignature(
      fileBuffer,
      signatureData,
      ipAddress,
      new Date().toISOString(),
      entityName,
      docType,
    );
    fileBuffer = signedBuffer.buffer;
  }

  // Convert buffer to base64 for Gemini OCR
  const fileBase64 = Buffer.from(fileBuffer).toString("base64");

  // 4. Perform Gemini AI OCR
  let ocrData = {};
  try {
    const ocrResult = await extractDocumentMetadata(fileBase64, finalMimeType, docType);
    if (ocrResult.success) {
      ocrData = ocrResult.metadata;
    }
  } catch (err) {
    console.error("AI OCR failed in background:", err);
  }

  // 5. Upload to Supabase Storage
  const bucketName = magicLink.entity_type === "vendor" ? "vendor-documents" : "crm-documents";
  const fileExt = fileName.split(".").pop();
  const storageName = `${docType}_${Date.now()}.${fileExt}`;
  const filePath = `${magicLink.entity_type === "vendor" ? "vendors" : "customers"}/${magicLink.entity_id}/${docType}/${storageName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(filePath, fileBuffer, { contentType: finalMimeType, upsert: false });

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucketName).getPublicUrl(filePath);

  // 6. DB Updates & File Tracking
  let uploadedFile: { id: string; file_name: string; file_url?: string } | null = null;
  if (magicLink.entity_type === "vendor") {
    const { data: existingDoc } = await supabase
      .from("vendor_documents")
      .select("id")
      .eq("vendor_id", magicLink.entity_id)
      .eq("doc_type", docType)
      .is("archived_at", null)
      .maybeSingle();

    let docId = "";
    if (existingDoc) {
      docId = existingDoc.id;
    } else {
      const { data: newDoc, error: dbError } = await supabase
        .from("vendor_documents")
        .insert({
          vendor_id: magicLink.entity_id,
          doc_type: docType,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ocr_data: ocrData,
        })
        .select("id")
        .single();
      if (dbError || !newDoc) return { error: dbError?.message || "Failed to insert document" };
      docId = newDoc.id;
    }

    // Append a new file slot (portal uploads accumulate instead of replacing)
    const { data: fileRow, error: fileError } = await supabase
      .from("vendor_document_files")
      .insert({
        document_id: docId,
        file_url: publicUrl,
        file_name: fileName,
        notes: notes || "Uploaded via Portal",
      })
      .select("id")
      .single();

    if (fileError || !fileRow) return { error: fileError?.message || "Failed to save file" };
    // Sign immediately so the portal can show a live view link without refresh
    let signedForReturn = publicUrl;
    try {
      const { data: s } = await supabase.storage.from(bucketName).createSignedUrl(filePath, 3600);
      if (s?.signedUrl) signedForReturn = s.signedUrl;
    } catch {}
    uploadedFile = { id: fileRow.id, file_name: fileName, file_url: signedForReturn };

    const { data: maxVer } = await supabase
      .from("vendor_document_file_versions")
      .select("version_number")
      .eq("file_id", fileRow.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error: versionError } = await supabase
      .from("vendor_document_file_versions")
      .insert({
        file_id: fileRow.id,
        version_number: (maxVer?.version_number || 0) + 1,
        file_url: publicUrl,
        file_name: fileName,
        notes: notes || "Uploaded via Portal",
      });
    if (versionError) return { error: versionError.message };

    const { error: dbError } = await supabase
      .from("vendor_documents")
      .update({
        file_url: publicUrl,
        file_name: fileName,
        status: "submitted",
        expiry_date: expiryDate || (ocrData as any).expiry_date || null,
        notes: notes || null,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ocr_data: ocrData,
      })
      .eq("id", docId);
    if (dbError) return { error: dbError.message };

    // Trigger Notification for Procurement
    await createNotificationForRoles({
      type: "vendor",
      title: "📁 Portal Upload: Vendor Compliance",
      message: `${entityName} uploaded a file for ${docType.toUpperCase().replace(/_/g, " ")}.`,
      link: `/dashboard/vendors/${magicLink.entity_id}`,
      created_by: null,
      roles: ["operations"],
    });

  } else {
    // Customer documents
    const { data: existingDoc } = await supabase
      .from("crm_documents")
      .select("id, version_number")
      .eq("account_id", magicLink.entity_id)
      .eq("doc_type", docType)
      .is("archived_at", null)
      .maybeSingle();

    const versionNumber = existingDoc ? existingDoc.version_number + 1 : 1;
    const documentPayload = {
      account_id: magicLink.entity_id,
      doc_type: docType,
      file_url: publicUrl,
      file_name: fileName,
      status: "submitted",
      expiry_date: expiryDate || (ocrData as any).expiry_date || null,
      notes: notes || null,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ocr_data: ocrData,
      version_number: versionNumber,
    };

    let docId = "";
    if (existingDoc) {
      const { error: dbError } = await supabase
        .from("crm_documents")
        .update(documentPayload)
        .eq("id", existingDoc.id);
      if (dbError) return { error: dbError.message };
      docId = existingDoc.id;
    } else {
      const { data: newDoc, error: dbError } = await supabase
        .from("crm_documents")
        .insert(documentPayload)
        .select("id")
        .single();
      if (dbError || !newDoc) return { error: dbError?.message || "Failed to insert document" };
      docId = newDoc.id;
    }

    // Save Version Entry
    const { data: versionEntry } = await supabase
      .from("crm_document_versions")
      .insert({
        document_id: docId,
        version_number: versionNumber,
        file_url: publicUrl,
        file_name: fileName,
        notes: notes || "Uploaded via Portal",
      })
      .select("id")
      .single();

    if (versionEntry) {
      await supabase
        .from("crm_documents")
        .update({ current_version_id: versionEntry.id })
        .eq("id", docId);
    }

    // Trigger Notification for CRM
    await createNotificationForRoles({
      type: "crm",
      title: "📁 Portal Upload: Customer File",
      message: `${entityName} uploaded a new ${docType.toUpperCase().replace(/_/g, " ")} (v${versionNumber}).`,
      link: `/dashboard/crm/${magicLink.entity_id}`,
      created_by: null,
      roles: ["operations"],
    });
  }

  return { success: true, ocrData, uploadedFile };
}
