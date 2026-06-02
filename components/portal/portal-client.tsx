"use client";

import React, { useState, useRef, useEffect } from "react";
import { uploadPortalDocument } from "@/app/portal/actions";
import { 
  FileText, CheckCircle2, AlertCircle, Upload, PenTool, X, ShieldAlert,
  Loader2, Sparkles, FileCheck, RefreshCw, Calendar, FileQuestion
} from "lucide-react";
import { toast } from "sonner";

interface Document {
  id?: string;
  doc_type: string;
  status: string;
  expiry_date?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  notes?: string | null;
}

interface PortalClientProps {
  token: string;
  entityType: "vendor" | "customer";
  entity: {
    id: string;
    name?: string;
    company_name?: string;
    contact_person?: string;
    contact_email?: string;
  };
  initialDocuments: Document[];
}

const DOCUMENT_LABELS: Record<string, string> = {
  // Vendor
  signed_nda: "Signed NDA",
  statement_of_commitment: "Statement of Commitment",
  company_profile: "Company Profile",
  products_services_list: "Products & Services List",
  vendor_information_summary: "Vendor Information Summary",
  general_information_sheet: "General Information Sheet",
  audited_financial_statements: "Audited Financial Statements",
  sec_registration: "SEC Registration",
  secretary_certificate: "Secretary Certificate",
  safety_drug_policy: "Safety & Drug Policy",
  iso_certification: "ISO Certification",
  pcab_license: "PCAB License",
  dole_174: "DOLE 174 Registration",
  other_licenses: "Other Licenses & Permits",
  // Customer
  official_receipt: "Official Receipt (OR)",
  specimen_signature: "Specimen Signature Sheet",
  valid_id: "Valid Government ID"
};

export default function PortalClient({
  token,
  entityType,
  entity,
  initialDocuments
}: PortalClientProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  
  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  // Signature pad state
  const [hasSigned, setHasSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  const entityName = entity.name || entity.company_name || "Valued Partner";

  // Build standard list of required document types
  const requiredTypes = entityType === "vendor" 
    ? [
        "signed_nda", "statement_of_commitment", "company_profile",
        "products_services_list", "vendor_information_summary",
        "general_information_sheet", "audited_financial_statements",
        "sec_registration", "secretary_certificate", "safety_drug_policy",
        "iso_certification", "pcab_license", "dole_174", "other_licenses"
      ]
    : ["official_receipt", "specimen_signature", "valid_id"];

  // Populate missing documents
  const documentMap = new Map<string, Document>();
  documents.forEach(d => documentMap.set(d.doc_type, d));

  const completeCount = documents.filter(d => d.status === "approved" || d.status === "submitted").length;
  const totalCount = requiredTypes.length;
  const progressPercent = Math.round((completeCount / totalCount) * 100);

  // Signature canvas handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    isDrawing.current = true;
    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ("touches" in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000000";
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ("touches" in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  // Adjust signature canvas size on open
  useEffect(() => {
    if (selectedDocType && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.parentElement?.clientWidth || 400;
      canvas.height = 240;
      clearSignature();
    }
  }, [selectedDocType]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedDocType) {
      toast.error("Please select a file first.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    if (expiryDate) formData.append("expiryDate", expiryDate);
    if (notes) formData.append("notes", notes);

    // If signature is required, extract it from canvas
    if (["signed_nda", "specimen_signature"].includes(selectedDocType) && hasSigned && canvasRef.current) {
      const signatureImage = canvasRef.current.toDataURL("image/png");
      formData.append("signatureImage", signatureImage);
    }

    try {
      const result = await uploadPortalDocument(token, selectedDocType, formData);
      if (result.error) {
        toast.error(`Upload failed: ${result.error}`);
      } else {
        toast.success("Document uploaded successfully!", {
          icon: <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
        });
        
        // Show AI OCR extraction feedback
        if (result.ocrData && Object.keys(result.ocrData).length > 0) {
          const ocr: any = result.ocrData;
          let msg = "";
          if (ocr.expiry_date) msg += `Expiry: ${ocr.expiry_date}. `;
          if (ocr.tin) msg += `TIN: ${ocr.tin}. `;
          if (ocr.amount) msg += `Amount: PHP ${Number(ocr.amount).toLocaleString()}. `;
          
          if (msg) {
            toast.info(`AI OCR Extracted Details: ${msg}`, { duration: 6000 });
          }
        }

        // Re-fetch documents
        const activeDoc = {
          doc_type: selectedDocType,
          status: "submitted",
          file_name: file.name,
          expiry_date: expiryDate || null,
          notes: notes || null
        };
        setDocuments(prev => {
          const filtered = prev.filter(d => d.doc_type !== selectedDocType);
          return [...filtered, activeDoc];
        });

        // Close upload section
        setSelectedDocType(null);
        setFile(null);
        setExpiryDate("");
        setNotes("");
        setHasSigned(false);
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4 md:p-8">
      {/* Header Info */}
      <div className="bg-gradient-to-br from-[#041A10] to-[#072F1C] border border-emerald-950 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-10 blur-3xl w-96 h-96 bg-primary rounded-full" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <span className="bg-emerald-800/60 border border-emerald-700/50 text-emerald-300 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
              {entityType === "vendor" ? "Vendor Accreditation" : "Customer Onboarding"}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-plus-jakarta mt-3">
              {entityName}
            </h1>
            <p className="text-sm text-emerald-300/80 mt-1 max-w-xl">
              Welcome to the TelcoVantage document upload portal. Please submit the requested items below to complete your system profile.
            </p>
          </div>

          {/* Progress gauge */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4">
            <div className="relative h-16 w-16 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="32" cy="32" r="28" className="stroke-white/10 fill-none" strokeWidth="4" />
                <circle cx="32" cy="32" r="28" className="stroke-primary fill-none transition-all duration-1000" 
                  strokeWidth="4" 
                  strokeDasharray={2 * Math.PI * 28} 
                  strokeDashoffset={2 * Math.PI * 28 * (1 - progressPercent / 100)} 
                />
              </svg>
              <span className="absolute text-sm font-bold">{progressPercent}%</span>
            </div>
            <div>
              <p className="text-xs uppercase text-emerald-300 font-semibold tracking-wider">Progress</p>
              <p className="text-lg font-bold">{completeCount} / {totalCount} Files</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Requirements Grid */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Onboarding Requirements
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requiredTypes.map((type) => {
              const doc = documentMap.get(type);
              const label = DOCUMENT_LABELS[type] || type;
              
              let statusColor = "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50";
              let statusText = "Missing";
              let StatusIcon = AlertCircle;

              if (doc) {
                if (doc.status === "approved") {
                  statusColor = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50";
                  statusText = "Approved";
                  StatusIcon = CheckCircle2;
                } else if (doc.status === "submitted") {
                  statusColor = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50";
                  statusText = "Under Review";
                  StatusIcon = RefreshCw;
                } else if (doc.status === "expired") {
                  statusColor = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50";
                  statusText = "Expired";
                  StatusIcon = ShieldAlert;
                }
              }

              return (
                <button
                  key={type}
                  onClick={() => setSelectedDocType(type)}
                  className={`flex flex-col text-left p-5 rounded-2xl border transition-all ${
                    selectedDocType === type
                      ? "border-primary bg-primary/5 shadow-md shadow-primary/5 ring-1 ring-primary"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] hover:border-slate-300 dark:hover:border-emerald-800 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between w-full gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-500 dark:text-slate-400 flex-shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusText}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-slate-900 dark:text-white mt-4 line-clamp-1">
                    {label}
                  </h3>
                  
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {doc?.file_name ? `Uploaded: ${doc.file_name}` : "Click to draw signature and upload document."}
                  </p>
                  
                  {doc?.expiry_date && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mt-3 border-t border-slate-100 dark:border-slate-800/50 pt-2 w-full">
                      <Calendar className="h-3 w-3" />
                      Expires: {doc.expiry_date}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Dynamic Form Panel */}
        <div className="lg:col-span-1">
          {selectedDocType ? (
            <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl sticky top-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white font-plus-jakarta text-lg">
                  Submit {DOCUMENT_LABELS[selectedDocType] || selectedDocType}
                </h3>
                <button 
                  onClick={() => setSelectedDocType(null)}
                  className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="space-y-6 mt-6">
                
                {/* File Dropzone */}
                <div>
                  <label className="block text-xs uppercase text-slate-500 font-bold tracking-wider mb-2">
                    File Attachment
                  </label>
                  <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-primary transition-all">
                    <input 
                      type="file" 
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      required
                    />
                    <Upload className="mx-auto h-8 w-8 text-slate-400 mb-3" />
                    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {file ? file.name : "Select or drag file"}
                    </span>
                    <span className="block text-xs text-slate-400 mt-1">
                      PDF, JPG, PNG up to 10MB
                    </span>
                  </div>
                </div>

                {/* Optional E-Signature Canvas for specific documents */}
                {["signed_nda", "specimen_signature"].includes(selectedDocType) && (
                  <div className="space-y-2 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs uppercase text-slate-500 font-bold tracking-wider flex items-center gap-1.5">
                        <PenTool className="h-4 w-4 text-primary" />
                        Canvas E-Signature
                      </label>
                      {hasSigned && (
                        <button 
                          type="button" 
                          onClick={clearSignature}
                          className="text-xs text-red-500 font-semibold"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-inner">
                      <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="cursor-crosshair w-full block bg-white touch-none"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
                      Draw signature directly. We will stamp this on the uploaded PDF as an Audit Receipt.
                    </p>
                  </div>
                )}

                {/* Expiry Date */}
                <div>
                  <label className="block text-xs uppercase text-slate-500 font-bold tracking-wider mb-2">
                    Document Expiry Date
                  </label>
                  <input 
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-500 animate-pulse" />
                    AI will attempt to auto-extract this if left blank.
                  </p>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs uppercase text-slate-500 font-bold tracking-wider mb-2">
                    Notes
                  </label>
                  <textarea 
                    rows={3}
                    placeholder="Add notes or descriptions if needed..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isUploading}
                  className="w-full bg-primary hover:bg-primary/90 text-white rounded-2xl py-3.5 font-bold transition-all shadow-lg shadow-primary/20 active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Uploading & Extracting with AI...
                    </>
                  ) : (
                    <>
                      <FileCheck className="h-5 w-5" />
                      Upload Document
                    </>
                  )}
                </button>

              </form>
            </div>
          ) : (
            <div className="bg-slate-50/50 dark:bg-slate-900/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
              <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 mb-4 animate-bounce duration-1000">
                <FileQuestion className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-slate-700 dark:text-slate-300">No Document Selected</h3>
              <p className="text-xs text-slate-400 mt-2 max-w-[200px] mx-auto">
                Select one of the requirements on the left to begin uploading or signing.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
