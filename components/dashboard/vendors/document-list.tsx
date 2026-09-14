"use client";

import { useState } from "react";
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Loader2,
  Calendar,
  ShieldCheck,
  Plus,
  X,
  History,
  RotateCcw,
  User,
  Trash2,
  ChevronDown,
  ChevronRight,
  Files,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  uploadDocument,
  uploadDocumentFiles,
  approveVendorDocument,
  uploadCustomVendorDocument,
  approveVendorDocumentById,
  updateVendorDocumentFile,
  deleteVendorDocumentFile,
  getVendorDocumentFileVersions,
  getVendorFileVersionSignedUrl,
  rollbackVendorDocumentFile,
  createVendorSignedUploadUrl,
  confirmVendorDirectUpload,
} from "@/app/dashboard/vendors/actions";
import { RequestDocumentsButton } from "./request-documents-button";
import { hasCapability } from "@/lib/auth/roles";

const DOCUMENT_TYPES = [
  { id: 'signed_nda', label: 'Signed NDA' },
  { id: 'statement_of_commitment', label: 'Statement of Commitment' },
  { id: 'company_profile', label: 'Company Profile and Client References' },
  { id: 'products_services_list', label: 'List of Products or Services' },
  { id: 'vendor_information_summary', label: 'Vendor Information Summary' },
  { id: 'general_information_sheet', label: 'Latest General Information Sheet' },
  { id: 'audited_financial_statements', label: 'AFS 2025' },
  { id: 'sec_registration', label: 'SEC Registration / DTI' },
  { id: 'secretary_certificate', label: 'Secretary Certificate' },
  { id: 'safety_drug_policy', label: 'Safety & Drug Free Policy' },
  { id: 'iso_certification', label: 'ISO Certification' },
  { id: 'pcab_license', label: 'PCAB License' },
  { id: 'dole_174', label: 'DOLE 174' },
  { id: 'other_licenses', label: 'Other Licenses or Permits' },
];

interface DocumentFile {
  id: string;
  file_url?: string;
  file_name?: string;
  notes?: string | null;
  created_at?: string;
  uploaded_by?: string;
}

interface Document {
  id: string;
  doc_type: string;
  label?: string;
  status: string;
  file_url?: string;
  file_name?: string;
  expiry_date?: string;
  version_number?: number;
  current_version_id?: string;
  vendor_document_files?: DocumentFile[];
}

interface VersionInfo {
  id: string;
  version_number: number;
  file_name: string;
  file_url: string;
  notes: string | null;
  created_at: string;
  uploaded_by: string;
  is_current: boolean;
  profiles?: { full_name: string; email: string } | { full_name: string; email: string }[];
}

export function DocumentList({ vendorId, documents, userRole, optionalDocTypes = [] }: { vendorId: string; documents: Document[]; userRole?: string; optionalDocTypes?: string[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadName, setUploadName] = useState<string>("");
  const [approvingDoc, setApprovingDoc] = useState<string | null>(null);
  const [approveExpiryDate, setApproveExpiryDate] = useState("");
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customFiles, setCustomFiles] = useState<File[]>([]);
  const [customUploading, setCustomUploading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [historyFile, setHistoryFile] = useState<DocumentFile | null>(null);
  const [historyDocName, setHistoryDocName] = useState("");
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rollbacking, setRollbacking] = useState<string | null>(null);
  const router = useRouter();

  const putWithProgress = (url: string, file: File) => new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed ${xhr.status}: ${xhr.responseText.slice(0,200)}`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });

  const fixedDocs = documents.filter((d) => d.doc_type !== 'custom');
  const customDocs = [...documents.filter((d) => d.doc_type === 'custom')]
    .sort((a, b) => new Date(b.expiry_date || 0).getTime() - new Date(a.expiry_date || 0).getTime());

  const getDocStatus = (type: string) => fixedDocs.find((d) => d.doc_type === type);

  const customSubmittedCount = customDocs.filter((d) => d.status === 'submitted' || d.status === 'approved').length;
  const submittedCount = fixedDocs.filter((d) => (d.status === 'submitted' || d.status === 'approved') && !optionalDocTypes.includes(d.doc_type)).length + customSubmittedCount;
  const requiredDocTypes = DOCUMENT_TYPES.length - optionalDocTypes.filter((t) => DOCUMENT_TYPES.some((dt) => dt.id === t)).length;
  const progressPercent = Math.min(100, Math.round((submittedCount / requiredDocTypes) * 100));

  const ndaDoc = getDocStatus('signed_nda');
  const ndaApproved = ndaDoc?.status === 'approved';
  const ndaExpired = ndaDoc?.status === 'expired';

  const isAdmin = hasCapability(userRole, 'document.approve');

  const handleUpload = async (doc: Document | null, docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.size > 0);
    if (files.length === 0) return;
    setBusy(`add:${doc ? doc.id : docType}`);
    // reset file input so same file can be retried
    const input = e.target;
    try {
      for (const f of files) {
        if (f.size > 50 * 1024 * 1024) { alert(`${f.name} exceeds 50MB`); continue; }
        setUploadName(f.name);
        setUploadPct(0);
        const urlRes: any = await createVendorSignedUploadUrl(vendorId, docType, f.name, f.type || "application/octet-stream");
        if (urlRes?.error || !urlRes?.success) {
          setUploadPct(null);
          const formData = new FormData();
          formData.append('file', f);
          const r = doc ? await uploadDocumentFiles(doc.id, formData) : await uploadDocument(vendorId, docType, formData);
          if (r.error) { alert(r.error); break; }
          continue;
        }
        await putWithProgress(urlRes.signedUrl, f);
        setUploadPct(100);
        const conf: any = await confirmVendorDirectUpload(vendorId, docType, urlRes.path, f.name, f.type || "application/octet-stream", null, null);
        if (conf?.error) { alert(conf.error); break; }
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setBusy(null);
      setUploadPct(null);
      setUploadName("");
      input.value = "";
    }
  };

  const handleUpdateFile = async (fileId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(`update:${fileId}`);
    const formData = new FormData();
    formData.append('file', file);
    const result = await updateVendorDocumentFile(fileId, formData);
    if (result.error) alert(result.error);
    else router.refresh();
    setBusy(null);
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    setBusy(`delete:${fileId}`);
    const result = await deleteVendorDocumentFile(fileId);
    if (result.error) alert(result.error);
    else router.refresh();
    setBusy(null);
  };

  const handleApprove = async (docType: string) => {
    if (!approveExpiryDate) { setApproveError("An expiry date is required."); return; }
    setApproving(true);
    setApproveError(null);
    const result = await approveVendorDocument(vendorId, docType, approveExpiryDate);
    if (result.error) { setApproveError(result.error); }
    else { setApprovingDoc(null); setApproveExpiryDate(""); router.refresh(); }
    setApproving(false);
  };

  const handleApproveById = async (docId: string) => {
    if (!approveExpiryDate) { setApproveError("An expiry date is required."); return; }
    setApproving(true);
    setApproveError(null);
    const result = await approveVendorDocumentById(docId, approveExpiryDate);
    if (result.error) { setApproveError(result.error); }
    else { setApprovingDoc(null); setApproveExpiryDate(""); router.refresh(); }
    setApproving(false);
  };

  const handleCustomUpload = async () => {
    if (customFiles.length === 0 || !customLabel.trim()) return;
    setCustomUploading(true);
    const formData = new FormData();
    customFiles.forEach((f) => formData.append('file', f));
    const result = await uploadCustomVendorDocument(vendorId, customLabel.trim(), formData);
    if (result.error) { alert(result.error); }
    else { router.refresh(); }
    setCustomUploading(false);
    setShowAddForm(false);
    setCustomLabel('');
    setCustomFiles([]);
  };

  const openHistory = async (file: DocumentFile, docName: string) => {
    setHistoryFile(file);
    setHistoryDocName(docName);
    setLoadingVersions(true);
    const result = await getVendorDocumentFileVersions(file.id);
    setLoadingVersions(false);
    if (result.error) { alert(result.error); setHistoryFile(null); }
    else setVersions((result.versions as VersionInfo[]) || []);
  };

  const closeHistory = () => { setHistoryFile(null); setVersions([]); };

  const handleRollback = async (versionId: string) => {
    if (!historyFile) return;
    if (!confirm('Roll back to this version?')) return;
    setRollbacking(versionId);
    const result = await rollbackVendorDocumentFile(historyFile.id, versionId);
    setRollbacking(null);
    if (result.error) alert(result.error);
    else router.refresh();
  };

  const handleViewVersion = async (versionId: string) => {
    const result = await getVendorFileVersionSignedUrl(versionId);
    if (result.error) alert(result.error);
    else if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
  };

  const getUploaderName = (v: VersionInfo) => {
    const profile = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
    return profile?.full_name || profile?.email || 'Unknown';
  };

  const docName = (doc: Document) =>
    doc.label || DOCUMENT_TYPES.find((t) => t.id === doc.doc_type)?.label || doc.doc_type.replace(/_/g, ' ');

  const toggleExpanded = (docId: string) => setExpanded((prev) => ({ ...prev, [docId]: !prev[docId] }));

  const UploadButton = ({ busy, onClick }: { busy: boolean; onClick: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <label className="cursor-pointer">
      <input type="file" multiple className="hidden" onChange={onClick} disabled={busy} />
      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
        busy
          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all border border-emerald-200 dark:border-emerald-800/50'
      }`}>
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        Add files
      </div>
    </label>
  );

  const RowActions = ({ doc, canApprove, onApprove }: {
    doc: Document; canApprove: boolean; onApprove: () => void;
  }) => {
    const files = doc.vendor_document_files || [];
    const isOpen = !!expanded[doc.id];
    return (
      <div className="flex items-center justify-end gap-1">
        {files.length > 0 && (
          <button
            onClick={() => toggleExpanded(doc.id)}
            className={`p-1.5 rounded-lg transition-colors ${isOpen ? 'text-primary bg-primary/5' : 'text-slate-400 hover:text-primary hover:bg-primary/5'}`}
            title={isOpen ? 'Hide files' : 'Show files'}
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        )}
        {canApprove && (
          approvingDoc === doc.id ? (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={approveExpiryDate}
                onChange={(e) => setApproveExpiryDate(e.target.value)}
                className="w-28 px-1.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0a0a0a] focus:outline-none focus:border-primary"
              />
              <button
                onClick={onApprove}
                disabled={approving}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-all disabled:opacity-50"
              >
                {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                OK
              </button>
              <button onClick={() => { setApprovingDoc(null); setApproveError(null); }} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                X
              </button>
            </div>
          ) : (
            <button
              onClick={() => setApprovingDoc(doc.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all border border-emerald-200 dark:border-emerald-800/50"
            >
              <ShieldCheck className="h-3 w-3" />
              Approve
            </button>
          )
        )}
        <UploadButton busy={busy === `add:${doc.id}`} onClick={(e) => handleUpload(doc, doc.doc_type, e)} />
      </div>
    );
  };

  const FileActions = ({ doc, file }: { doc: Document; file: DocumentFile }) => (
    <div className="flex items-center gap-1">
      {file.file_url && (
        <a href={file.file_url} target="_blank" rel="noopener noreferrer"
          className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-primary/5"
          title="View file"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      <button
        onClick={() => openHistory(file, docName(doc))}
        className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-primary/5"
        title="File history"
      >
        <History className="h-3.5 w-3.5" />
      </button>
      <label className="cursor-pointer" title="Replace this file">
        <input type="file" className="hidden" onChange={(e) => handleUpdateFile(file.id, e)} disabled={busy === `update:${file.id}`} />
        <div className={`p-1.5 rounded-lg transition-colors ${busy === `update:${file.id}` ? 'text-slate-300' : 'text-slate-400 hover:text-primary hover:bg-primary/5'}`}>
          {busy === `update:${file.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        </div>
      </label>
      <button
        onClick={() => handleDeleteFile(file.id)}
        disabled={busy === `delete:${file.id}`}
        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/5 disabled:opacity-50"
        title="Delete file"
      >
        {busy === `delete:${file.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );

  const FileRows = ({ doc }: { doc: Document }) => {
    const files = doc.vendor_document_files || [];
    if (!expanded[doc.id] || files.length === 0) return null;
    return (
      <tr className="bg-slate-50/50 dark:bg-slate-800/10 border-t-0">
        <td colSpan={4} className="px-6 py-3">
          <div className="space-y-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0a0a]/40 p-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              <Files className="h-3.5 w-3.5" /> Uploaded files ({files.length})
            </div>
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate" title={file.file_name}>
                      {file.file_name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {file.created_at ? new Date(file.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
                <FileActions doc={doc} file={file} />
              </div>
            ))}
          </div>
        </td>
      </tr>
    );
  };

  const StatusBadge = ({ doc }: { doc?: Document }) => {
    const isApproved = doc?.status === 'approved';
    const isSubmitted = doc?.status === 'submitted';
    const isExpired = doc?.status === 'expired';
    if (isApproved) return <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium"><CheckCircle2 className="h-4 w-4" />Approved</span>;
    if (isSubmitted) return <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium"><Clock className="h-4 w-4" />Submitted</span>;
    if (isExpired) return <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium"><AlertCircle className="h-4 w-4" />Expired</span>;
    return <span className="inline-flex items-center gap-1.5 text-slate-400 font-medium"><Clock className="h-4 w-4" />Not Submitted</span>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* NDA Status Indicator */}
      <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
        ndaApproved
          ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50'
          : ndaExpired
          ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50'
          : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50'
      }`}>
        {ndaApproved
          ? <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          : <AlertCircle className={`h-5 w-5 shrink-0 ${ndaExpired ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />}
        <div>
          <p className={`text-sm font-semibold ${ndaApproved ? 'text-emerald-700 dark:text-emerald-400' : ndaExpired ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
            {ndaApproved ? 'Signed NDA Approved' : ndaExpired ? 'Signed NDA Expired' : 'Signed NDA Not Approved'}
          </p>
          <p className={`text-xs ${ndaApproved ? 'text-emerald-600/80 dark:text-emerald-400/60' : ndaExpired ? 'text-red-600/80 dark:text-red-400/60' : 'text-amber-600/80 dark:text-amber-400/60'}`}>
            {ndaApproved
              ? `Expires ${ndaDoc?.expiry_date ? new Date(ndaDoc.expiry_date).toLocaleDateString() : 'N/A'}. Purchase orders can be created.`
              : ndaExpired
              ? 'The NDA has expired. PO creation is blocked until renewal.'
              : 'PO creation is blocked until the Signed NDA is submitted and approved by an admin.'}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Accreditation Progress</div>
          <div className="text-sm font-bold text-primary">{submittedCount} of {requiredDocTypes} Completed ({progressPercent}%)</div>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5">
          <div className="bg-primary h-2.5 rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
        </div>
        {uploadPct !== null && (
          <div className="mt-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Uploading {uploadName || "file"} — {uploadPct}%</span>
              <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{uploadPct}%</span>
            </div>
            <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-200" style={{ width: `${uploadPct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Documents</h2>
          <div className="flex items-center gap-2">
            {hasCapability(userRole, 'email.send') && (
              <RequestDocumentsButton vendorId={vendorId} documents={documents} />
            )}
            <button
              onClick={() => { setShowAddForm(!showAddForm); setApproveError(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
            >
              {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showAddForm ? 'Cancel' : 'Add Document'}
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/30">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                  Document Label <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g. Business Permit 2026"
                  className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all text-slate-900 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                  File <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setCustomFiles(Array.from(e.target.files || []))}
                  className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all"
                />
                {customFiles.length > 1 && <p className="text-[10px] text-slate-400 mt-1">{customFiles.length} files selected: {customFiles.map((f) => f.name).join(", ")}</p>}
                {customFiles.length === 1 && <p className="text-[10px] text-slate-400 mt-1">{customFiles[0].name}</p>}
              </div>
              <div className="shrink-0">
                <button
                  onClick={handleCustomUpload}
                  disabled={customUploading || customFiles.length === 0 || !customLabel.trim()}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary hover:bg-primary/90 shadow-sm"
                >
                  {customUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {customUploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        )}

        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Document</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Expiry</th>
              <th className="px-6 py-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {DOCUMENT_TYPES.map((type) => {
              const doc = getDocStatus(type.id);
              const isSubmitted = doc?.status === 'submitted' || doc?.status === 'approved';
              const isApproved = doc?.status === 'approved';
              const canApprove = isAdmin && doc?.status === 'submitted';
              const fileCount = doc?.vendor_document_files?.length || 0;

              return (
                <FragmentRow key={type.id}>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isApproved ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : isSubmitted ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className={`font-medium ${isSubmitted ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{type.label}</span>
                          {optionalDocTypes.includes(type.id) && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              Optional
                            </span>
                          )}
                          {fileCount > 0 && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {fileCount} file{fileCount > 1 ? 's' : ''}
                            </span>
                          )}
                          {doc?.file_name && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5 max-w-[220px]">
                              {doc.file_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><StatusBadge doc={doc} /></td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {doc?.expiry_date ? (
                        <div className="flex items-center gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5" />{new Date(doc.expiry_date).toLocaleDateString()}</div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {doc ? (
                        <>
                          <RowActions doc={doc} canApprove={canApprove} onApprove={() => handleApprove(type.id)} />
                          {approveError && approvingDoc === doc.id && (
                            <p className="text-[10px] text-red-500 mt-1 text-right">{approveError}</p>
                          )}
                        </>
                      ) : (
                        <label className="cursor-pointer">
                          <input type="file" multiple className="hidden" onChange={(e) => handleUpload(null, type.id, e)} disabled={busy === `add:${type.id}`} />
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all justify-end ${busy === `add:${type.id}` ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}>
                            {busy === `add:${type.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                            Upload
                          </div>
                        </label>
                      )}
                    </td>
                  </tr>
                  {doc && <FileRows doc={doc} />}
                </FragmentRow>
              );
            })}
            {customDocs.map((doc) => {
              const isSubmitted = doc.status === 'submitted' || doc.status === 'approved';
              const isApproved = doc.status === 'approved';
              const canApprove = isAdmin && doc.status === 'submitted';
              const fileCount = doc.vendor_document_files?.length || 0;

              return (
                <FragmentRow key={doc.id}>
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isApproved ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : isSubmitted ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className={`font-medium ${isSubmitted ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                            {doc.label || 'Untitled'}
                          </span>
                          {fileCount > 0 && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {fileCount} file{fileCount > 1 ? 's' : ''}
                            </span>
                          )}
                          {doc.file_name && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5 max-w-[220px]">
                              {doc.file_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><StatusBadge doc={doc} /></td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {doc.expiry_date ? (
                        <div className="flex items-center gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5" />{new Date(doc.expiry_date).toLocaleDateString()}</div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <RowActions doc={doc} canApprove={canApprove} onApprove={() => handleApproveById(doc.id)} />
                      {approveError && approvingDoc === doc.id && (
                        <p className="text-[10px] text-red-500 mt-1 text-right">{approveError}</p>
                      )}
                    </td>
                  </tr>
                  <FileRows doc={doc} />
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Per-File History Modal */}
      {historyFile && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={closeHistory}>
          <div className="relative w-full max-w-lg max-h-[80vh] bg-white dark:bg-[#071F15] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <History className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {historyDocName}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest truncate">File History · {historyFile.file_name}</p>
                </div>
              </div>
              <button onClick={closeHistory} className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {loadingVersions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : versions.length === 0 ? (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">No versions found.</p>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className={`p-4 rounded-2xl border transition-all ${v.is_current ? 'border-primary/40 bg-primary/[0.03] dark:bg-primary/[0.05]' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0a0a]/30'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${v.is_current ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              v{v.version_number}
                              {v.is_current && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary uppercase tracking-wider">Current</span>
                              )}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{v.file_name}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{getUploaderName(v)}</span>
                            <span>{new Date(v.created_at).toLocaleDateString()} {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {v.notes && <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1.5">&ldquo;{v.notes}&rdquo;</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => handleViewVersion(v.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all" title="View this version">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        {isAdmin && !v.is_current && (
                          <button
                            onClick={() => handleRollback(v.id)}
                            disabled={rollbacking === v.id}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-all border border-amber-200 dark:border-amber-800/50 disabled:opacity-50"
                          >
                            {rollbacking === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                            Rollback
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}