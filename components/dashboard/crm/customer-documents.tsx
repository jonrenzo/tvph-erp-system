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
  ShieldCheck
} from "lucide-react";
import { useRouter } from "next/navigation";
import { uploadCustomerDocument, approveCustomerDocument } from "@/app/dashboard/crm/actions";

const DOCUMENT_TYPES = [
  { id: 'official_receipt', label: 'Official Receipt' },
  { id: 'specimen_signature', label: 'Specimen Signature' },
  { id: 'valid_id', label: 'Valid ID' },
];

interface Document {
  doc_type: string;
  status: string;
  file_url?: string;
  file_name?: string;
  expiry_date?: string;
}

export function CustomerDocuments({ customerId, documents, userRole }: { customerId: string; documents: Document[]; userRole?: string }) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [approvingDoc, setApprovingDoc] = useState<string | null>(null);
  const [approveExpiryDate, setApproveExpiryDate] = useState("");
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const router = useRouter();

  const getDocStatus = (type: string) => {
    return documents.find(d => d.doc_type === type);
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

  const isAdmin = userRole === 'admin';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
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

              return (
                <tr key={type.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isApproved ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : isSubmitted ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <span className={`font-medium ${isSubmitted ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                        {type.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {isApproved ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        Approved
                      </span>
                    ) : doc?.status === 'submitted' ? (
                      <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                        <Clock className="h-4 w-4" />
                        Submitted
                      </span>
                    ) : doc?.status === 'expired' ? (
                      <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
                        <AlertCircle className="h-4 w-4" />
                        Expired
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-400 font-medium">
                        <Clock className="h-4 w-4" />
                        Not Submitted
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                    {doc?.expiry_date ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(doc.expiry_date).toLocaleDateString()}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isSubmitted && doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-primary transition-colors"
                          title="View Document"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}

                      {canApprove && (
                        approvingDoc === type.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={approveExpiryDate}
                              onChange={(e) => setApproveExpiryDate(e.target.value)}
                              className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-[#0a0a0a] focus:outline-none focus:border-primary"
                              placeholder="Expiry date"
                            />
                            <button
                              onClick={() => handleApprove(type.id)}
                              disabled={approving}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-all disabled:opacity-50"
                            >
                              {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                              Confirm
                            </button>
                            <button
                              onClick={() => { setApprovingDoc(null); setApproveError(null); }}
                              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setApprovingDoc(type.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all border border-emerald-200 dark:border-emerald-800/50"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )
                      )}

                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleUpload(type.id, e)}
                          disabled={uploading === type.id}
                        />
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          uploading === type.id
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                        }`}>
                          {uploading === type.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          {isSubmitted ? 'Update' : 'Upload'}
                        </div>
                      </label>
                    </div>
                    {approveError && approvingDoc === type.id && (
                      <p className="text-[10px] text-red-500 mt-1 text-right">{approveError}</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
