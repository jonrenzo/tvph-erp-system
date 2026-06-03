"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Upload, X, FileText, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteEmployeeDocument } from "@/app/dashboard/hr/actions";
import { recordAuditLog } from "@/utils/audit";

export function Employee201Vault({ employeeId, documents }: { employeeId: string, documents: any[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [isUploading, setIsUploading] = useState(false);
  const [docType, setDocType] = useState("resume");
  const [uploadProgress, setUploadProgress] = useState(0);

  const DOC_TYPES = [
    { value: "resume", label: "Resume / CV" },
    { value: "nbi_clearance", label: "NBI Clearance" },
    { value: "medical_certificate", label: "Medical Certificate" },
    { value: "sss_id", label: "SSS ID" },
    { value: "philhealth_id", label: "PhilHealth ID" },
    { value: "pagibig_id", label: "Pag-IBIG ID" },
    { value: "tin_card", label: "TIN Card" },
    { value: "employment_contract", label: "Employment Contract" },
    { value: "nda", label: "NDA" },
    { value: "bir_2316", label: "BIR Form 2316" },
    { value: "other", label: "Other" },
  ];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${employeeId}-${Date.now()}.${fileExt}`;
      const filePath = `201-files/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(filePath, file, { upsert: true });

      setUploadProgress(50);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("employee-documents")
        .getPublicUrl(filePath);

      setUploadProgress(80);

      const { error: dbError } = await supabase
        .from("employee_documents")
        .insert({
          employee_id: employeeId,
          doc_type: docType,
          file_name: file.name,
          file_url: publicUrlData.publicUrl,
        });

      if (dbError) throw dbError;
      
      setUploadProgress(100);
      router.refresh();
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload document.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      e.target.value = ''; // Reset file input
    }
  };

  const handleDelete = async (docId: string, url: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    await deleteEmployeeDocument(docId, employeeId, url);
  };

  return (
    <div className="space-y-6">
      <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50">
        <h3 className="font-bold text-slate-900 dark:text-white mb-4">Upload New Document</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <select 
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="flex-1 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] text-sm"
          >
            {DOC_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <div className="relative">
            <input 
              type="file" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
              onChange={handleUpload}
              disabled={isUploading}
            />
            <button 
              disabled={isUploading}
              className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isUploading ? `Uploading ${uploadProgress}%` : "Select File"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map(doc => (
          <div key={doc.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start justify-between bg-white dark:bg-[#071F15]">
            <div className="flex gap-3 overflow-hidden">
              <div className="h-10 w-10 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="overflow-hidden">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm text-slate-900 dark:text-white hover:text-primary transition-colors truncate block">
                  {DOC_TYPES.find(t => t.value === doc.doc_type)?.label || doc.doc_type}
                </a>
                <p className="text-xs text-slate-500 truncate" title={doc.file_name}>{doc.file_name}</p>
                <p className="text-[10px] text-slate-400 mt-1">{new Date(doc.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <button onClick={() => handleDelete(doc.id, doc.file_url)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors shrink-0">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        
        {documents.length === 0 && (
          <div className="col-span-full py-8 text-center text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No 201 documents uploaded yet.
          </div>
        )}
      </div>
    </div>
  );
}
