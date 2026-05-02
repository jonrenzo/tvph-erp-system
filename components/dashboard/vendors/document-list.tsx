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
  Calendar
} from "lucide-react";
import { useRouter } from "next/navigation";
import { uploadDocument } from "@/app/dashboard/vendors/actions";

const DOCUMENT_TYPES = [
  { id: 'signed_nda', label: 'Signed NDA' },
  { id: 'statement_of_commitment', label: 'Statement of Commitment' },
  { id: 'company_profile', label: 'Company Profile and Client References' },
  { id: 'products_services_list', label: 'List of Products or Services' },
  { id: 'vendor_information_summary', label: 'Vendor Information Summary' },
  { id: 'general_information_sheet', label: 'Latest General Information Sheet' },
  { id: 'audited_financial_statements', label: 'Audited Financial Statements (3yrs)' },
  { id: 'sec_registration', label: 'SEC Registration / Articles' },
  { id: 'secretary_certificate', label: 'Secretary Certificate' },
  { id: 'safety_drug_policy', label: 'Safety & Drug Free Policy' },
  { id: 'iso_certification', label: 'ISO Certification' },
  { id: 'pcab_license', label: 'PCAB License' },
  { id: 'dole_174', label: 'DOLE 174' },
  { id: 'other_licenses', label: 'Other Licenses or Permits' },
];

interface Document {
  doc_type: string;
  status: string;
  file_url?: string;
  file_name?: string;
  expiry_date?: string;
}

export function DocumentList({ vendorId, documents }: { vendorId: string, documents: Document[] }) {
  const [uploading, setUploading] = useState<string | null>(null);
  const router = useRouter();

  const getDocStatus = (type: string) => {
    return documents.find(d => d.doc_type === type);
  };

  const submittedCount = documents.filter(d => d.status === 'submitted' || d.status === 'approved').length;
  const progressPercent = Math.round((submittedCount / DOCUMENT_TYPES.length) * 100);

  const handleUpload = async (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(docType);
    const formData = new FormData();
    formData.append('file', file);
    
    const result = await uploadDocument(vendorId, docType, formData);
    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
      // Optional: Force a hard reload if router.refresh is too slow
      window.location.reload();
    }
    setUploading(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Progress Bar */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
            Accreditation Progress
          </div>
          <div className="text-sm font-bold text-primary">
            {submittedCount} of {DOCUMENT_TYPES.length} Completed ({progressPercent}%)
          </div>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5">
          <div 
            className="bg-primary h-2.5 rounded-full transition-all duration-1000" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Requirement</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Expiry</th>
              <th className="px-6 py-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {DOCUMENT_TYPES.map((type) => {
              const doc = getDocStatus(type.id);
              const isSubmitted = doc?.status === 'submitted' || doc?.status === 'approved';
              
              return (
                <tr key={type.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isSubmitted ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <span className={`font-medium ${isSubmitted ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                        {type.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {isSubmitted ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        {doc.status === 'approved' ? 'Approved' : 'Submitted'}
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
