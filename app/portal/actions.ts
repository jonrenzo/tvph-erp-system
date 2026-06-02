"use server";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { stampPdfWithSignature } from "@/utils/pdf-stamper";
import { extractDocumentMetadata } from "@/app/actions/ocr";
import { createNotification } from "@/utils/notifications";
import { revalidatePath } from "next/cache";

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
      .select("id, doc_type, status, expiry_date, file_name, file_url, notes")
      .eq("vendor_id", magicLink.entity_id)
      .is("archived_at", null);

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

  let fileBuffer = await file.arrayBuffer();
  let fileName = file.name;
  let finalMimeType = file.type;

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

  // 6. DB Updates & Version Tracking
  if (magicLink.entity_type === "vendor") {
    const { data: existingDoc } = await supabase
      .from("vendor_documents")
      .select("id, version_number")
      .eq("vendor_id", magicLink.entity_id)
      .eq("doc_type", docType)
      .is("archived_at", null)
      .maybeSingle();

    const versionNumber = existingDoc ? existingDoc.version_number + 1 : 1;
    const documentPayload = {
      vendor_id: magicLink.entity_id,
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
        .from("vendor_documents")
        .update(documentPayload)
        .eq("id", existingDoc.id);
      if (dbError) return { error: dbError.message };
      docId = existingDoc.id;
    } else {
      const { data: newDoc, error: dbError } = await supabase
        .from("vendor_documents")
        .insert(documentPayload)
        .select("id")
        .single();
      if (dbError || !newDoc) return { error: dbError?.message || "Failed to insert document" };
      docId = newDoc.id;
    }

    // Save Version Entry
    const { data: versionEntry } = await supabase
      .from("vendor_document_versions")
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
        .from("vendor_documents")
        .update({ current_version_id: versionEntry.id })
        .eq("id", docId);
    }

    // Trigger Notification for Procurement
    await createNotification({
      type: "vendor",
      title: "📁 Portal Upload: Vendor Compliance",
      message: `${entityName} uploaded a new ${docType.toUpperCase().replace(/_/g, " ")} (v${versionNumber}).`,
      link: `/dashboard/vendors/${magicLink.entity_id}`,
      created_by: magicLink.entity_id, // Route identifier
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
    await createNotification({
      type: "crm",
      title: "📁 Portal Upload: Customer File",
      message: `${entityName} uploaded a new ${docType.toUpperCase().replace(/_/g, " ")} (v${versionNumber}).`,
      link: `/dashboard/crm/${magicLink.entity_id}`,
      created_by: magicLink.entity_id,
    });
  }

  return { success: true, ocrData };
}
