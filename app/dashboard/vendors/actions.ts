"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { redirect } from "next/navigation";
import { createNotification } from "@/utils/notifications";
import { recordAuditLog } from "@/utils/audit";
import { parseFile, buildColumnMap } from "@/utils/import-export";
import { requireCapability } from "@/lib/auth/permissions";
import { createPortalLink } from "@/lib/portal/links";
import { docTypeLabel } from "@/lib/vendors/document-types";
import { sendEmail, internalCc } from "@/lib/email/send";
import { DocRequestEmail } from "@/lib/email/templates/doc-request";
import { getStorageProvider } from "@/lib/storage";

export async function approveVendorDocument(
  vendorId: string,
  docType: string,
  expiryDate: string,
) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("document.approve", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  if (!expiryDate) {
    return { error: "An expiry date is required when approving a document." };
  }

  const { error } = await supabase
    .from("vendor_documents")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      expiry_date: expiryDate,
      uploaded_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("vendor_id", vendorId)
    .eq("doc_type", docType)
    .is("archived_at", null);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: "vendor_document",
    entity_id: vendorId,
    action: "UPDATE",
    changes: {
      after: { doc_type: docType, status: "approved", expiry_date: expiryDate },
    },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/vendors/${vendorId}`);
  return { success: true };
}

export async function updateVendorStatus(
  vendorId: string,
  status: "active" | "inactive",
) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("vendor.status", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const { error } = await supabase
    .from("vendors")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", vendorId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: "vendor",
    entity_id: vendorId,
    action: "UPDATE",
    changes: { after: { status } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/vendors/${vendorId}`);
  return { success: true };
}

export async function uploadDocument(
  vendorId: string,
  docType: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("vendor.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  const expiryDate = formData.get("expiryDate") as string;
  const notes = formData.get("notes") as string;

  if (files.length === 0) return { error: "No file provided" };

  const oversized = files.find((f) => f.size > 50 * 1024 * 1024);
  if (oversized) return { error: `${oversized.name} exceeds the 50MB limit.` };

  const { data: existingDocument, error: existingError } = await supabase
    .from("vendor_documents")
    .select("id")
    .eq("vendor_id", vendorId)
    .eq("doc_type", docType)
    .is("archived_at", null)
    .maybeSingle();

  if (existingError) return { error: existingError.message };

  let docId = existingDocument?.id || "";
  if (!docId) {
    const { data: newDoc, error: insertError } = await supabase
      .from("vendor_documents")
      .insert({
        vendor_id: vendorId,
        doc_type: docType,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        uploaded_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !newDoc) return { error: insertError?.message || "Failed to create document" };
    docId = newDoc.id;
  }

  let lastUrl = "";
  let lastName = "";
  let uploadedCount = 0;

  const storage = getStorageProvider(supabase as any, "vendor-documents");
  for (const file of files) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${docType}_${Date.now()}_${uploadedCount}.${fileExt}`;
    const filePath = `vendors/${vendorId}/${docType}/${fileName}`;

    const { error: uploadError } = await storage.upload(filePath, file, { contentType: file.type, upsert: false });

    if (uploadError) return { error: uploadError.message };

    const {
      data: { publicUrl },
    } = storage.getPublicUrl(filePath);

    const { data: fileRow, error: fileInsertError } = await supabase
      .from("vendor_document_files")
      .insert({
        document_id: docId,
        file_url: publicUrl,
        file_name: file.name,
        uploaded_by: user.id,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (fileInsertError || !fileRow) {
      return { error: fileInsertError?.message || "Failed to save file" };
    }

    const { error: versionError } = await supabase
      .from("vendor_document_file_versions")
      .insert({
        file_id: fileRow.id,
        version_number: 1,
        file_url: publicUrl,
        file_name: file.name,
        uploaded_by: user.id,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (versionError) return { error: versionError.message };

    uploadedCount++;
    lastUrl = publicUrl;
    lastName = file.name;
  }

  const { error: dbError } = await supabase
    .from("vendor_documents")
    .update({
      file_url: lastUrl,
      file_name: lastName,
      status: "submitted",
      expiry_date: expiryDate || null,
      notes: notes || null,
      submitted_at: new Date().toISOString(),
      uploaded_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", docId);

  if (dbError) return { error: dbError.message };

  await recordAuditLog({
    entity_type: "vendor_document",
    entity_id: vendorId,
    action: "UPDATE",
    changes: { after: { doc_type: docType, status: "submitted", files_added: uploadedCount } },
    performed_by: user.id,
  });

  await createNotification({
    type: "vendor",
    title: "📁 Vendor Document Added",
    message: `${uploadedCount} file(s) added for document ${docType}.`,
    link: `/dashboard/vendors/${vendorId}`,
    created_by: user.id,
  });

  revalidatePath(`/dashboard/vendors/${vendorId}`);
  return { success: true };
}

/** Adds one or more files to an existing document row (e.g. extra files for a custom doc). */
export async function uploadDocumentFiles(
  documentId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("vendor.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "No file provided" };

  const { data: doc } = await supabase
    .from("vendor_documents")
    .select("id, vendor_id, doc_type, label")
    .eq("id", documentId)
    .is("archived_at", null)
    .single();

  if (!doc) return { error: "Document not found" };

  let lastUrl = "";
  let lastName = "";
  let uploadedCount = 0;

  const storageAdd = getStorageProvider(supabase as any, "vendor-documents");
  for (const file of files) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${doc.doc_type}_${Date.now()}_${uploadedCount}.${fileExt}`;
    const filePath = `vendors/${doc.vendor_id}/${doc.doc_type === "custom" ? "custom" : doc.doc_type}/${fileName}`;

    const { error: uploadError } = await storageAdd.upload(filePath, file, { contentType: file.type, upsert: false });
    if (uploadError) return { error: uploadError.message };

    const { data: { publicUrl } } = storageAdd.getPublicUrl(filePath);

    const { data: fileRow, error: fileInsertError } = await supabase
      .from("vendor_document_files")
      .insert({
        document_id: doc.id,
        file_url: publicUrl,
        file_name: file.name,
        uploaded_by: user.id,
      })
      .select("id")
      .single();
    if (fileInsertError || !fileRow) return { error: fileInsertError?.message || "Failed to save file" };

    const { error: versionError } = await supabase
      .from("vendor_document_file_versions")
      .insert({
        file_id: fileRow.id,
        version_number: 1,
        file_url: publicUrl,
        file_name: file.name,
        uploaded_by: user.id,
      });
    if (versionError) return { error: versionError.message };

    uploadedCount++;
    lastUrl = publicUrl;
    lastName = file.name;
  }

  const { error: dbError } = await supabase
    .from("vendor_documents")
    .update({
      file_url: lastUrl,
      file_name: lastName,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      uploaded_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", doc.id);
  if (dbError) return { error: dbError.message };

  await recordAuditLog({
    entity_type: "vendor_document",
    entity_id: doc.vendor_id,
    action: "UPDATE",
    changes: { after: { document_id: doc.id, status: "submitted", files_added: uploadedCount } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/vendors/${doc.vendor_id}`);
  return { success: true };
}

/** Replaces a single uploaded file (keeps the previous file in per-file history). */
export async function updateVendorDocumentFile(
  fileId: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("vendor.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const file = formData.get("file") as File;
  if (!file) return { error: "No file provided" };

  const { data: fileRow } = await supabase
    .from("vendor_document_files")
    .select("id, document_id, file_url, vendor_documents(doc_type, label, vendor_id)")
    .eq("id", fileId)
    .single();

  if (!fileRow) return { error: "File not found" };

  const doc = fileRow.vendor_documents as any;
  if (!doc) return { error: "Document not found" };

  const labelSlug = doc.label
    ? doc.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/, "").slice(0, 40)
    : doc.doc_type;
  const fileExt = file.name.split(".").pop();
  const fileName = `${labelSlug}_${Date.now()}.${fileExt}`;
  const filePath = `vendors/${doc.vendor_id}/${doc.doc_type === "custom" ? "custom" : doc.doc_type}/${fileName}`;

  const storageUpd = getStorageProvider(supabase as any, "vendor-documents");
  const { error: uploadError } = await storageUpd.upload(filePath, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = storageUpd.getPublicUrl(filePath);

  const { data: maxVer } = await supabase
    .from("vendor_document_file_versions")
    .select("version_number")
    .eq("file_id", fileId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (maxVer?.version_number || 0) + 1;

  const { data: version, error: versionError } = await supabase
    .from("vendor_document_file_versions")
    .insert({
      file_id: fileId,
      version_number: nextVersion,
      file_url: publicUrl,
      file_name: file.name,
      uploaded_by: user.id,
      notes: null,
    })
    .select("id")
    .single();

  if (versionError || !version) {
    return { error: versionError?.message || "Failed to save file version" };
  }

  const { error: updateError } = await supabase
    .from("vendor_document_files")
    .update({
      file_url: publicUrl,
      file_name: file.name,
      uploaded_by: user.id,
    })
    .eq("id", fileId);

  if (updateError) return { error: updateError.message };

  await supabase
    .from("vendor_documents")
    .update({
      file_url: publicUrl,
      file_name: file.name,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      uploaded_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fileRow.document_id);

  await recordAuditLog({
    entity_type: "vendor_document",
    entity_id: doc.vendor_id,
    action: "UPDATE",
    changes: { after: { document_id: fileRow.document_id, file_updated: file.name, version: nextVersion } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/vendors/${doc.vendor_id}`);
  return { success: true };
}

/** Deletes a single uploaded file (cascades its history) and removes storage objects. */
export async function deleteVendorDocumentFile(fileId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("vendor.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const { data: fileRow } = await supabase
    .from("vendor_document_files")
    .select("id, document_id, file_url, file_name, vendor_documents(vendor_id)")
    .eq("id", fileId)
    .single();

  if (!fileRow) return { error: "File not found" };

  const { data: versions } = await supabase
    .from("vendor_document_file_versions")
    .select("file_url")
    .eq("file_id", fileId);

  const storagePaths = [fileRow.file_url, ...(versions || []).map((v) => v.file_url)]
    .map((url) => url.split("/public/vendor-documents/")[1])
    .filter((p): p is string => Boolean(p));

  if (storagePaths.length > 0) {
    const storageDel = getStorageProvider(supabase as any, "vendor-documents");
    await storageDel.remove(storagePaths);
  }

  const { error } = await supabase
    .from("vendor_document_files")
    .delete()
    .eq("id", fileId);

  if (error) return { error: error.message };

  const { data: remaining } = await supabase
    .from("vendor_document_files")
    .select("file_url, file_name")
    .eq("document_id", fileRow.document_id)
    .order("created_at", { ascending: false });

  const latest = remaining?.[0];
  await supabase
    .from("vendor_documents")
    .update({
      file_url: latest?.file_url || null,
      file_name: latest?.file_name || null,
      status: latest ? "submitted" : "not_submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", fileRow.document_id);

  await recordAuditLog({
    entity_type: "vendor_document",
    entity_id: (fileRow.vendor_documents as any)?.vendor_id,
    action: "DELETE",
    changes: { after: { document_id: fileRow.document_id, file_deleted: fileRow.file_name } },
    performed_by: user.id,
  });

  const vendorId = (fileRow.vendor_documents as any)?.vendor_id;
  if (vendorId) revalidatePath(`/dashboard/vendors/${vendorId}`);
  return { success: true };
}

/** Returns the version history for a single uploaded file (oldest-aware, current flagged). */
export async function getVendorDocumentFileVersions(fileId: string) {
  const supabase = await createClient();

  const { data: fileRow } = await supabase
    .from("vendor_document_files")
    .select("file_url")
    .eq("id", fileId)
    .single();

  if (!fileRow) return { versions: [] };

  const { data: versions, error } = await supabase
    .from("vendor_document_file_versions")
    .select(`
      id,
      version_number,
      file_name,
      file_url,
      notes,
      created_at,
      uploaded_by,
      profiles!uploaded_by(full_name, email)
    `)
    .eq("file_id", fileId)
    .order("version_number", { ascending: false });

  if (error) return { error: error.message };

  return {
    versions: (versions || []).map((v) => ({
      ...v,
      is_current: v.file_url === fileRow.file_url,
    })),
  };
}

/** Rolls a single uploaded file back to one of its historical versions. */
export async function rollbackVendorDocumentFile(
  fileId: string,
  versionId: string,
) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("document.approve", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const { data: version } = await supabase
    .from("vendor_document_file_versions")
    .select("file_url, file_name")
    .eq("id", versionId)
    .eq("file_id", fileId)
    .single();

  if (!version) return { error: "Version not found" };

  const { data: fileRow } = await supabase
    .from("vendor_document_files")
    .select("id, document_id, vendor_documents(vendor_id)")
    .eq("id", fileId)
    .single();

  if (!fileRow) return { error: "File not found" };

  const { error } = await supabase
    .from("vendor_document_files")
    .update({ file_url: version.file_url, file_name: version.file_name })
    .eq("id", fileId);

  if (error) return { error: error.message };

  await supabase
    .from("vendor_documents")
    .update({
      file_url: version.file_url,
      file_name: version.file_name,
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", fileRow.document_id);

  await recordAuditLog({
    entity_type: "vendor_document",
    entity_id: (fileRow.vendor_documents as any)?.vendor_id,
    action: "UPDATE",
    changes: { after: { action: "rollback_file", file_id: fileId, version_id: versionId } },
    performed_by: user.id,
  });

  const vendorId = (fileRow.vendor_documents as any)?.vendor_id;
  if (vendorId) revalidatePath(`/dashboard/vendors/${vendorId}`);
  return { success: true };
}

/** Signed URL for a specific file-version record (per-file history). */
export async function getVendorFileVersionSignedUrl(versionId: string) {
  const supabase = await createClient();
  const { data: version } = await supabase
    .from("vendor_document_file_versions")
    .select("file_url")
    .eq("id", versionId)
    .single();

  if (!version) return { error: "Version not found" };

  const path = version.file_url.split("/public/vendor-documents/")[1];
  if (!path) return { url: version.file_url };

  const storageSign = getStorageProvider(supabase as any, "vendor-documents");
  const { data } = await storageSign.createSignedUrl(path, 3600);

  return { url: data?.signedUrl || version.file_url };
}

export async function createVendor(prevState: any, formData: FormData) {
  const supabase = await createClient();

  const { user, error: authError } = await requireCapability("vendor.write", supabase);
  if (authError || !user) return { error: authError || "You must be logged in to create a vendor." };

  const name = formData.get("name") as string;
  const address = formData.get("address") as string;
  const tin = formData.get("tin") as string;
  const contact_person = formData.get("contact_person") as string;
  const contact_email = formData.get("contact_email") as string;
  const contact_phone = formData.get("contact_phone") as string;
  const contact_fax = formData.get("contact_fax") as string;
  const bank_name = formData.get("bank_name") as string;
  const bank_account_number = formData.get("bank_account_number") as string;
  const bank_account_name = formData.get("bank_account_name") as string;
  const payment_terms = formData.get("payment_terms") as string;
  const notes = formData.get("notes") as string;
  const currency = (formData.get("currency") as string) || "PHP";

  let secondary_contacts = [];
  try {
    secondary_contacts = JSON.parse(
      (formData.get("secondary_contacts") as string) || "[]",
    );
  } catch (e) {
    console.error("Error parsing secondary contacts:", e);
  }

  let secondary_banking = [];
  try {
    secondary_banking = JSON.parse(
      (formData.get("secondary_banking") as string) || "[]",
    );
  } catch (e) {
    console.error("Error parsing secondary banking:", e);
  }

  if (!name || name.trim() === "") {
    return { error: "Vendor name is required." };
  }

  const { data: newVendor, error } = await supabase
    .from("vendors")
    .insert({
      name,
      address,
      tin,
      contact_person,
      contact_email,
      contact_phone,
      contact_fax,
      bank_name,
      bank_account_number,
      bank_account_name,
      payment_terms,
      notes,
      currency,
      secondary_contacts,
      secondary_banking,
      created_by: user.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating vendor:", error);
    return { error: error.message || "Failed to create vendor." };
  }

  // Basic Audit log
  await recordAuditLog({
    entity_type: "vendor",
    entity_id: newVendor.id,
    action: "CREATE",
    changes: { after: { name, tin, contact_person, status: "pending" } },
    performed_by: user.id,
  });

  revalidatePath("/dashboard/vendors");
  redirect(`/dashboard/vendors/${newVendor.id}`);
}

export async function updateVendorProfile(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("vendor.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const id = formData.get("id") as string;
  if (!id) return { error: "Vendor ID is required." };

  // Only written when the form sends them, so the detail-page profile form
  // (which omits these fields) can't clobber them.
  const rawName = formData.get("name") as string | null;
  const rawVendorCode = formData.get("vendor_code") as string | null;
  const rawCurrency = formData.get("currency") as string | null;

  const name = rawName?.trim() ?? "";
  const vendor_code = rawVendorCode?.trim() ?? "";

  if (rawName !== null && !name) return { error: "Vendor name is required." };
  if (rawVendorCode !== null && !vendor_code) {
    return { error: "Vendor code is required." };
  }
  if (rawVendorCode !== null) {
    const { data: clash } = await supabase
      .from("vendors")
      .select("id")
      .eq("vendor_code", vendor_code)
      .neq("id", id)
      .maybeSingle();
    if (clash) {
      return { error: `Vendor code "${vendor_code}" is already in use by another vendor.` };
    }
  }

  const address = formData.get("address") as string;
  const tin = formData.get("tin") as string;
  const contact_person = formData.get("contact_person") as string;
  const contact_email = formData.get("contact_email") as string;
  const contact_phone = formData.get("contact_phone") as string;
  const contact_fax = formData.get("contact_fax") as string;
  const bank_name = formData.get("bank_name") as string;
  const bank_account_number = formData.get("bank_account_number") as string;
  const bank_account_name = formData.get("bank_account_name") as string;
  const payment_terms = formData.get("payment_terms") as string;
  const notes = formData.get("notes") as string;

  let secondary_contacts = [];
  try {
    secondary_contacts = JSON.parse(
      (formData.get("secondary_contacts") as string) || "[]",
    );
  } catch (e) {
    console.error("Error parsing secondary contacts:", e);
  }

  let secondary_banking = [];
  try {
    secondary_banking = JSON.parse(
      (formData.get("secondary_banking") as string) || "[]",
    );
  } catch (e) {
    console.error("Error parsing secondary banking:", e);
  }

  const { error } = await supabase
    .from("vendors")
    .update({
      ...(rawName !== null ? { name } : {}),
      ...(rawVendorCode !== null ? { vendor_code } : {}),
      ...(rawCurrency !== null ? { currency: rawCurrency } : {}),
      address,
      tin,
      contact_person,
      contact_email,
      contact_phone,
      contact_fax,
      bank_name,
      bank_account_number,
      bank_account_name,
      payment_terms,
      notes,
      secondary_contacts,
      secondary_banking,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating vendor:", error);
    return { error: error.message || "Failed to update vendor." };
  }

  await recordAuditLog({
    entity_type: "vendor",
    entity_id: id,
    action: "UPDATE",
    changes: {
      after: {
        ...(rawName !== null ? { name } : {}),
        ...(rawVendorCode !== null ? { vendor_code } : {}),
        contact_person,
        secondary_contacts,
        secondary_banking,
      },
    },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/vendors/${id}`);
  return { success: true };
}

export async function deleteVendor(vendorId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("vendor.delete", supabase);
  if (authError || !user) return { error: authError || "Unauthorized." };

  const { error } = await supabase.from("vendors").delete().eq("id", vendorId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: "vendor",
    entity_id: vendorId,
    action: "DELETE",
    performed_by: user.id,
  });

  revalidatePath("/dashboard/vendors");
  return { success: true };
}

const VALID_VENDOR_FIELDS = new Set([
  "name", "address", "tin", "contact_person", "contact_email",
  "contact_phone", "contact_fax", "bank_name", "bank_account_number",
  "bank_account_name", "payment_terms", "currency", "notes", "status",
]);

function extractSecondaryContact(
  row: Record<string, any>,
  columnMap: Record<string, string>,
): Record<string, string> | null {
  const nameCol = Object.entries(columnMap).find(([, v]) => v === "_sc_name")?.[0];
  const emailCol = Object.entries(columnMap).find(([, v]) => v === "_sc_email")?.[0];
  const phoneCol = Object.entries(columnMap).find(([, v]) => v === "_sc_phone")?.[0];

  const name = nameCol && row[nameCol] !== undefined && row[nameCol] !== null ? String(row[nameCol]).trim() : "";
  const email = emailCol && row[emailCol] !== undefined && row[emailCol] !== null ? String(row[emailCol]).trim() : "";
  const phone = phoneCol && row[phoneCol] !== undefined && row[phoneCol] !== null ? String(row[phoneCol]).trim() : "";

  if (!name && !email && !phone) return null;
  return {
    contact_name: name || "",
    contact_email: email || "",
    contact_phone: phone || "",
  };
}

function extractSecondaryBanking(
  row: Record<string, any>,
  columnMap: Record<string, string>,
): Record<string, string> | null {
  const nameCol = Object.entries(columnMap).find(([, v]) => v === "_sb_bank_name")?.[0];
  const acctNoCol = Object.entries(columnMap).find(([, v]) => v === "_sb_account_number")?.[0];
  const acctNameCol = Object.entries(columnMap).find(([, v]) => v === "_sb_account_name")?.[0];

  const name = nameCol && row[nameCol] !== undefined && row[nameCol] !== null ? String(row[nameCol]).trim() : "";
  const acctNo = acctNoCol && row[acctNoCol] !== undefined && row[acctNoCol] !== null ? String(row[acctNoCol]).trim() : "";
  const acctName = acctNameCol && row[acctNameCol] !== undefined && row[acctNameCol] !== null ? String(row[acctNameCol]).trim() : "";

  if (!name && !acctNo && !acctName) return null;
  return {
    bank_name: name || "",
    account_number: acctNo || "",
    account_name: acctName || "",
  };
}

export async function importVendors(formData: FormData) {
  const userClient = await createClient();
  const { user, error: authError } = await requireCapability("vendor.write", userClient);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const supabase = createServiceRoleClient();

  const file = formData.get("file") as File;
  if (!file) return { error: "No file provided" };

  const buffer = await file.arrayBuffer();
  let rows: Record<string, string>[];
  try {
    rows = parseFile(buffer);
  } catch {
    return { error: "Failed to parse file. Please ensure it is a valid CSV or Excel file." };
  }

  if (rows.length === 0) {
    return { error: "The file appears to be empty." };
  }

  const fileHeaders = Object.keys(rows[0]);
  const customMappingStr = formData.get("columnMapping") as string | null;
  const columnMap = customMappingStr ? JSON.parse(customMappingStr) as Record<string, string> : buildColumnMap(fileHeaders);
  const unmappedColumns = fileHeaders.filter((h) => !columnMap[h]);

  const validStatuses = ["pending", "active", "inactive"];

  const vendorGroups = new Map<string, { row: Record<string, string>; rowIndex: number }[]>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const vendorNameRaw = row["Vendor Name"] || row["name"] || row["Name"] || "";
    const tinRaw = row["TIN"] || row["tin"] || "";
    const name = String(vendorNameRaw).trim().toLowerCase();
    const tin = String(tinRaw).trim().toLowerCase();
    const key = name || tin || `row_${i}`;
    const group = vendorGroups.get(key) || [];
    group.push({ row, rowIndex: i });
    vendorGroups.set(key, group);
  }

  let created = 0;
  let updated = 0;
  const errors: { row: number; reason: string }[] = [];

  for (const [, group] of vendorGroups) {
    const firstRow = group[0].row;

    try {
      const mainFields: Record<string, any> = {};
      for (const [fileCol, dbField] of Object.entries(columnMap)) {
        if (VALID_VENDOR_FIELDS.has(dbField)) {
          const val = firstRow[fileCol];
          mainFields[dbField] = val !== undefined && val !== null ? String(val).trim() : null;
        }
      }

      if (!mainFields.name) {
        for (const g of group) errors.push({ row: g.rowIndex + 2, reason: "Missing vendor name." });
        continue;
      }

      if (mainFields.status && !validStatuses.includes(mainFields.status.toLowerCase())) {
        mainFields.status = "pending";
      }

      const secondaryContacts: Record<string, string>[] = [];
      const secondaryBanking: Record<string, string>[] = [];

      for (const g of group) {
        const sc = extractSecondaryContact(g.row, columnMap);
        if (sc) secondaryContacts.push(sc);

        const sb = extractSecondaryBanking(g.row, columnMap);
        if (sb) secondaryBanking.push(sb);
      }

      const { data: existing } = await supabase
        .from("vendors")
        .select("id, secondary_contacts, secondary_banking")
        .or(`name.ilike.${mainFields.name.replace(/'/g, "''")}${mainFields.tin ? `,tin.ilike.${mainFields.tin.replace(/'/g, "''")}` : ""}`)
        .is("deleted_at", null)
        .maybeSingle();

      if (existing) {
        const updateFields: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const [k, v] of Object.entries(mainFields)) {
          if (k !== "name") updateFields[k] = v;
        }

        const mergedContacts = [...(existing.secondary_contacts || []), ...secondaryContacts];
        const mergedBanking = [...(existing.secondary_banking || []), ...secondaryBanking];
        if (mergedContacts.length) updateFields.secondary_contacts = mergedContacts;
        if (mergedBanking.length) updateFields.secondary_banking = mergedBanking;

        const { error: updateErr } = await supabase
          .from("vendors")
          .update(updateFields)
          .eq("id", existing.id);
        if (updateErr) {
          for (const g of group) errors.push({ row: g.rowIndex + 2, reason: updateErr.message });
          continue;
        }
        updated++;
      } else {
        const insertData: Record<string, any> = {
          ...mainFields,
          status: mainFields.status || "pending",
          secondary_contacts: secondaryContacts.length ? secondaryContacts : [],
          secondary_banking: secondaryBanking.length ? secondaryBanking : [],
          created_by: user.id,
        };
        const { error: insertErr } = await supabase
          .from("vendors")
          .insert(insertData);
        if (insertErr) {
          for (const g of group) errors.push({ row: g.rowIndex + 2, reason: insertErr.message });
          continue;
        }
        created++;
      }
    } catch (err: any) {
      for (const g of group) errors.push({ row: g.rowIndex + 2, reason: err.message || "Unexpected error" });
    }
  }

  await recordAuditLog({
    entity_type: "vendor",
    entity_id: "bulk",
    action: "CREATE",
    changes: { after: { import_summary: { created, updated, errors: errors.length } } },
    performed_by: user.id,
  });

  revalidatePath("/dashboard/vendors");
  return { created, updated, errors, columnMapping: columnMap, unmappedColumns, totalRows: rows.length };
}

// Project actions have been moved to app/dashboard/projects/actions.ts

export async function uploadCustomVendorDocument(
  vendorId: string,
  label: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("vendor.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "No file provided" };

  const labelSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/, "").slice(0, 40);

  // Create one doc row for this custom label; all selected files attach to it
  const { data: newDoc, error: insertError } = await supabase
    .from("vendor_documents")
    .insert({
      vendor_id: vendorId,
      doc_type: "custom",
      label: label.trim(),
      status: "submitted",
      submitted_at: new Date().toISOString(),
      uploaded_by: user.id,
      version_number: 1,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !newDoc) return { error: insertError?.message || "Failed to create document" };

  let lastUrl = "";
  let lastName = "";
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileExt = file.name.split(".").pop();
    const fileName = `${labelSlug}_${Date.now()}_${i}.${fileExt}`;
    const filePath = `vendors/${vendorId}/custom/${fileName}`;
    const customStorage = getStorageProvider(supabase as any, "vendor-documents");
    const { error: uploadError } = await customStorage.upload(filePath, file, { contentType: file.type, upsert: false });
    if (uploadError) return { error: uploadError.message };
    const { data: { publicUrl } } = customStorage.getPublicUrl(filePath);
    const { data: fileRow, error: fileInsertError } = await supabase.from("vendor_document_files").insert({ document_id: newDoc.id, file_url: publicUrl, file_name: file.name, uploaded_by: user.id }).select("id").single();
    if (fileInsertError || !fileRow) return { error: fileInsertError?.message || "Failed to save file" };
    const { error: versionError } = await supabase.from("vendor_document_file_versions").insert({ file_id: fileRow.id, version_number: 1, file_url: publicUrl, file_name: file.name, uploaded_by: user.id });
    if (versionError) return { error: versionError.message };
    lastUrl = publicUrl;
    lastName = file.name;
  }

  await supabase.from("vendor_documents").update({ file_url: lastUrl, file_name: lastName, updated_at: new Date().toISOString() }).eq("id", newDoc.id);

  await recordAuditLog({
    entity_type: "vendor_document",
    entity_id: vendorId,
    action: "CREATE",
    changes: { after: { doc_type: "custom", label, status: "submitted" } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/vendors/${vendorId}`);
  return { success: true };
}

export async function approveVendorDocumentById(
  documentId: string,
  expiryDate: string,
) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("document.approve", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  if (!expiryDate) return { error: "An expiry date is required when approving a document." };

  const { data: doc } = await supabase
    .from("vendor_documents")
    .select("vendor_id, label")
    .eq("id", documentId)
    .single();

  if (!doc) return { error: "Document not found." };

  const { error } = await supabase
    .from("vendor_documents")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      expiry_date: expiryDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .is("archived_at", null);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: "vendor_document",
    entity_id: documentId,
    action: "UPDATE",
    changes: { after: { status: "approved", expiry_date: expiryDate } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/vendors/${doc.vendor_id}`);
  return { success: true };
}

/**
 * Emails a vendor an on-demand request to submit/update a set of documents,
 * including a checklist and a fresh magic-link to the upload portal.
 */
export async function requestVendorDocuments(
  vendorId: string,
  docTypes: string[],
  note?: string,
) {
  const supabase = await createClient();
  const { user, profile, error: authError } = await requireCapability("email.send", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  if (!docTypes || docTypes.length === 0) {
    return { error: "Select at least one document to request." };
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("name, contact_person, contact_email")
    .eq("id", vendorId)
    .single();

  if (!vendor) return { error: "Vendor not found." };
  if (!vendor.contact_email) {
    return { error: "This vendor has no contact email on file." };
  }

  const link = await createPortalLink("vendor", vendorId);
  if ("error" in link) return { error: link.error };

  const labels = docTypes.map((t) => docTypeLabel(t));

  const result = await sendEmail({
    kind: "doc_request",
    refId: vendorId,
    to: [vendor.contact_email],
    cc: internalCc(profile?.email),
    subject: `Document submission request from TVPH`,
    react: DocRequestEmail({
      vendorName: vendor.name || "Vendor",
      vendorContact: vendor.contact_person,
      documentLabels: labels,
      portalUrl: link.portalUrl,
      senderName: profile?.full_name,
      note: note || null,
    }),
    createdBy: user.id,
    vendorId,
  });

  await recordAuditLog({
    entity_type: "vendor",
    entity_id: vendorId,
    action: "UPDATE",
    changes: { after: { documents_requested: docTypes, email_status: result.status } },
    performed_by: user.id,
  });

  if (result.status === "sent") {
    await createNotification({
      type: "vendor",
      title: "✉️ Documents requested",
      message: `Requested ${labels.length} document(s) from ${vendor.name}.`,
      link: `/dashboard/vendors/${vendorId}`,
      created_by: user.id,
    });
  }

  revalidatePath(`/dashboard/vendors/${vendorId}`);
  if (result.status === "failed") {
    return { error: result.error || "Failed to send email." };
  }
  return { success: true };
}
