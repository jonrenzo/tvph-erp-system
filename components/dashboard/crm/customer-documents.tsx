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
  HardDrive,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  uploadCustomerDocument,
  uploadCustomCustomerDocument,
  uploadDocumentVersion,
  approveCustomerDocument,
  approveCustomerDocumentById,
  getDocumentVersions,
  getVersionSignedUrl,
  rollbackDocumentVersion,
} from "@/app/dashboard/crm/actions";

const DOCUMENT_TYPES = [
  { id: 'official_receipt', label: 'Official Receipt' },
  { id: 'specimen_signature', label: 'Specimen Signature' },
  { id: 'valid_id', label: 'Valid ID' },
];

interface Document {
  id: string;
  doc_type: string;
  label?: string;
  status: string;
  file_url?: string;
  file_name?: string;
  expiry_date?: string;
  created_at?: string;
  version_number?: number;
  current_version_id?: string;
}

interface VersionInfo {
  id: string;
  version_number: number;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  notes: string | null;
  created_at: string;
  uploaded_by: string;
  is_current: boolean;
  profiles?: { full_name: string; email: string } | { full_name: string; email: string }[];
}

export function CustomerDocuments({ customerId, documents, userRole }: { customerId: string; documents: Document[]; userRole?: string }) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [approvingDoc, setApprovingDoc] = useState<string | null>(null);
  const [approveExpiryDate, setApproveExpiryDate] = useState("");
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [customUploading, setCustomUploading] = useState(false);
  const router = useRouter();

  const [historyDoc, setHistoryDoc] = useState<Document | null>(null);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rollbacking, setRollbacking] = useState<string | null>(null);

  const fixedDocs = documents.filter(d => d.doc_type !== 'custom');
  const customDocs = [...documents.filter(d => d.doc_type === 'custom')]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const getDocStatus = (type: string) => {
    return fixedDocs.find(d => d.doc_type === type);
  };

  const handleUpload = async (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(docType);
    const formData = new FormData();
    formData.append('file', file);

    const result = await uploadCustomerDocument(customerId, docType, formData);
    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
      window.location.reload();
    }
    setUploading(null);
  };

  const handleCustomUpload = async () => {
    if (!customFile || !customLabel.trim()) return;
    setCustomUploading(true);
    const formData = new FormData();
    formData.append('file', customFile);
    const result = await uploadCustomCustomerDocument(customerId, customLabel.trim(), formData);
    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
      window.location.reload();
    }
    setCustomUploading(false);
    setShowAddForm(false);
    setCustomLabel('');
    setCustomFile(null);
  };

  const handleUpdateVersion = async (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(docId);
    const formData = new FormData();
    formData.append('file', file);
    const result = await uploadDocumentVersion(docId, formData);
    if (result.error) alert(result.error);
    else { router.refresh(); window.location.reload(); }
    setUploading(null);
  };

  const handleApprove = async (docType: string) => {
    if (!approveExpiryDate) {
      setApproveError("An expiry date is required.");
      return;
    }
    setApproving(true);
    setApproveError(null);
    const result = await approveCustomerDocument(customerId, docType, approveExpiryDate);
    if (result.error) {
      setApproveError(result.error);
    } else {
      setApprovingDoc(null);
      setApproveExpiryDate("");
      window.location.reload();
    }
    setApproving(false);
  };

  const handleApproveById = async (docId: string) => {
    if (!approveExpiryDate) {
      setApproveError("An expiry date is required.");
      return;
    }
    setApproving(true);
    setApproveError(null);
    const result = await approveCustomerDocumentById(docId, approveExpiryDate);
    if (result.error) {
      setApproveError(result.error);
    } else {
      setApprovingDoc(null);
      setApproveExpiryDate("");
      window.location.reload();
    }
    setApproving(false);
  };

  const openHistory = async (doc: Document) => {
    setHistoryDoc(doc);
    setLoadingVersions(true);
    const result = await getDocumentVersions(doc.id);
    setLoadingVersions(false);
    if (result.error) {
      alert(result.error);
      setHistoryDoc(null);
    } else {
      setVersions(result.versions || []);
    }
  };

  const closeHistory = () => {
    setHistoryDoc(null);
    setVersions([]);
  };

  const handleRollback = async (versionId: string) => {
    if (!historyDoc) return;
    if (!confirm('Roll back to this version? The document file will point to this older version.')) return;
    setRollbacking(versionId);
    const result = await rollbackDocumentVersion(historyDoc.id, versionId);
    setRollbacking(null);
    if (result.error) {
      alert(result.error);
    } else {
      window.location.reload();
    }
  };

  const handleViewVersion = async (versionId: string) => {
    const result = await getVersionSignedUrl(versionId);
    if (result.error) {
      alert(result.error);
    } else if (result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer');
    }
  };

  const isAdmin = userRole === 'admin';

  const formatBytes = (bytes: number | null) => {
    if (!bytes || bytes === 0) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getUploaderName = (v: VersionInfo) => {
    const profile = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
    return profile?.full_name || profile?.email || 'Unknown';
  };

  const RowActions = ({ doc, isSubmitted, isApproved, canApprove, docIdent, onApprove }: {
    doc: Document; isSubmitted: boolean; isApproved: boolean; canApprove: boolean;
    docIdent: string; onApprove: () => void;
  }) => (
    <div className="flex items-center justify-end gap-1">
      {(doc.version_number || 0) > 0 && (
        <button
          onClick={() => openHistory(doc)}
          className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-primary/5"
          title="Version history"
        >
          <History className="h-3.5 w-3.5" />
        </button>
      )}
      {isSubmitted && doc.file_url && (
        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-primary/5" title="View Document">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      {canApprove && (
        approvingDoc === docIdent ? (
          <div className="flex items-center gap-1.5">
            <input type="date" value={approveExpiryDate} onChange={(e) => setApproveExpiryDate(e.target.value)} className="w-28 px-1.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0a0a0a] focus:outline-none focus:border-primary" />
            <button onClick={onApprove} disabled={approving} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-all disabled:opacity-50">
              {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
              OK
            </button>
            <button onClick={() => { setApprovingDoc(null); setApproveError(null); }} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">X</button>
          </div>
        ) : (
          <button onClick={() => setApprovingDoc(docIdent)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all border border-emerald-200 dark:border-emerald-800/50">
            <ShieldCheck className="h-3 w-3" />
            Approve
          </button>
        )
      )}
      <label className="cursor-pointer">
        <input type="file" className="hidden" onChange={(e) => {
          if (doc.doc_type === 'custom') {
            handleUpdateVersion(doc.id, e);
          } else {
            handleUpload(doc.doc_type, e);
          }
        }} disabled={uploading === (doc.doc_type === 'custom' ? doc.id : doc.doc_type)} />
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${uploading === (doc.doc_type === 'custom' ? doc.id : doc.doc_type) ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}>
          {uploading === (doc.doc_type === 'custom' ? doc.id : doc.doc_type) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {(isSubmitted || (doc.version_number || 0) > 0) ? 'Update' : 'Upload'}
        </div>
      </label>
    </div>
  );

  return (
    <>
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-500">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">Documents</h2>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setApproveError(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
          >
            {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showAddForm ? 'Cancel' : 'Add Document'}
          </button>
        </div>

        {showAddForm && (
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/30">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="doc-label" className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                  Document Label <span className="text-rose-500">*</span>
                </label>
                <input id="doc-label" type="text" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="e.g. Signed Contract" className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all text-slate-900 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 placeholder:text-slate-300 dark:placeholder:text-slate-600" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="doc-file" className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">
                  File <span className="text-rose-500">*</span>
                </label>
                <input id="doc-file" type="file" onChange={(e) => setCustomFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all" />
              </div>
              <div className="shrink-0">
                <button onClick={handleCustomUpload} disabled={customUploading || !customFile || !customLabel.trim()} className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary hover:bg-primary/90 shadow-sm">
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
              const hasVersion = (doc?.version_number || 0) > 0;

              return (
                <tr key={type.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isApproved ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : isSubmitted ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <span className={`font-medium ${isSubmitted ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                          {type.label}
                        </span>
                        {hasVersion && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            v{doc!.version_number}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {isApproved ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium"><CheckCircle2 className="h-4 w-4" />Approved</span>
                    ) : doc?.status === 'submitted' ? (
                      <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium"><Clock className="h-4 w-4" />Submitted</span>
                    ) : doc?.status === 'expired' ? (
                      <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium"><AlertCircle className="h-4 w-4" />Expired</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-400 font-medium"><Clock className="h-4 w-4" />Not Submitted</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                    {doc?.expiry_date ? (
                      <div className="flex items-center gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5" />{new Date(doc.expiry_date).toLocaleDateString()}</div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {doc ? (
                      <RowActions doc={doc} isSubmitted={isSubmitted} isApproved={isApproved} canApprove={canApprove} docIdent={type.id} onApprove={() => handleApprove(type.id)} />
                    ) : (
                      <label className="cursor-pointer">
                        <input type="file" className="hidden" onChange={(e) => handleUpload(type.id, e)} disabled={uploading === type.id} />
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${uploading === type.id ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'}`}>
                          {uploading === type.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          Upload
                        </div>
                      </label>
                    )}
                  </td>
                </tr>
              );
            })}

            {customDocs.map((doc) => {
              const isSubmitted = doc.status === 'submitted' || doc.status === 'approved';
              const isApproved = doc.status === 'approved';
              const canApprove = isAdmin && doc.status === 'submitted';
              const hasVersion = (doc.version_number || 0) > 0;

              return (
                <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isApproved ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : isSubmitted ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <span className={`font-medium ${isSubmitted ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                          {doc.label || 'Untitled'}
                        </span>
                        {hasVersion && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            v{doc.version_number}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {isApproved ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium"><CheckCircle2 className="h-4 w-4" />Approved</span>
                    ) : doc.status === 'submitted' ? (
                      <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium"><Clock className="h-4 w-4" />Submitted</span>
                    ) : doc.status === 'expired' ? (
                      <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium"><AlertCircle className="h-4 w-4" />Expired</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-400 font-medium"><Clock className="h-4 w-4" />Not Submitted</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                    {doc.expiry_date ? (
                      <div className="flex items-center gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5" />{new Date(doc.expiry_date).toLocaleDateString()}</div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <RowActions doc={doc} isSubmitted={isSubmitted} isApproved={isApproved} canApprove={canApprove} docIdent={doc.id} onApprove={() => handleApproveById(doc.id)} />
                    {approveError && approvingDoc === doc.id && (
                      <p className="text-[10px] text-red-500 mt-1 text-right">{approveError}</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {customDocs.length === 0 && !showAddForm && (
          <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
            No additional documents added yet. Click <strong>Add Document</strong> to upload a custom document.
          </div>
        )}
      </div>

      {/* Version History Modal */}
      {historyDoc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={closeHistory}>
          <div className="relative w-full max-w-lg max-h-[80vh] bg-white dark:bg-[#071F15] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {historyDoc.label || (DOCUMENT_TYPES.find(t => t.id === historyDoc.doc_type)?.label || historyDoc.doc_type.replace(/_/g, ' '))}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Version History</p>
                </div>
              </div>
              <button onClick={closeHistory} className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm">
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
                            <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />{formatBytes(v.file_size)}</span>
                          </div>
                          {v.notes && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1.5">&ldquo;{v.notes}&rdquo;</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => handleViewVersion(v.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all" title="View this version">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        {isAdmin && !v.is_current && (
                          <button onClick={() => handleRollback(v.id)} disabled={rollbacking === v.id} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-all border border-amber-200 dark:border-amber-800/50 disabled:opacity-50" title="Set as current version">
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
    </>
  );
}
