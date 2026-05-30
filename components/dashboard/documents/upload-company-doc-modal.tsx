"use client";

import { useCallback, useRef, useState, useEffect, useActionState } from "react";
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CalendarDays,
  Tag,
  ChevronDown,
} from "lucide-react";
import { uploadCompanyDocument } from "@/app/dashboard/documents/actions";

const DOC_TYPE_OPTIONS = [
  { value: "legal", label: "Legal & Compliance" },
  { value: "hr", label: "HR & Staffing" },
  { value: "finance", label: "Financials" },
  { value: "template", label: "Company Templates" },
] as const;

type FormState = {
  success?: boolean;
  error?: string;
  fileName?: string;
} | null;

interface UploadCompanyDocModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export function UploadCompanyDocModal({
  isOpen,
  onClose,
}: UploadCompanyDocModalProps) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    uploadCompanyDocument,
    null,
  );

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleClose = useCallback(() => {
    setSelectedFile(null);
    setDragActive(false);
    formRef.current?.reset();
    onClose();
  }, [onClose]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Auto-close on success after a brief delay
  useEffect(() => {
    if (state?.success) {
      const t = setTimeout(() => handleClose(), 2200);
      return () => clearTimeout(t);
    }
  }, [state, handleClose]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleSubmit = (formData: FormData) => {
    if (selectedFile) formData.set("file", selectedFile);
    formAction(formData);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* ── Backdrop & Modal Container ───────────────────────────────────── */}
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={handleClose}
      >
        <div
          className="relative w-full max-w-lg max-h-[85vh] bg-white dark:bg-[#071F15] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Decorative glow — visible only in dark mode */}
          <div
            className="absolute -top-20 -left-20 w-64 h-64 rounded-full pointer-events-none hidden dark:block opacity-20"
            style={{
              background:
                "radial-gradient(circle, #0A5C3B 0%, transparent 70%)",
            }}
          />
          {/* Subtle grid texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.025] dark:opacity-[0.035]"
            style={{
              backgroundImage: `linear-gradient(rgba(0,0,0,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.8) 1px, transparent 1px)`,
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative z-10 flex flex-col min-h-0 flex-1 overflow-hidden">
            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20 shrink-0 h-24">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <UploadCloud className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2
                    className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    Upload File
                  </h2>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">
                    Company Library
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                id="upload-modal-close"
                className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* ── Success State ─────────────────────────────────────────── */}
            {state?.success ? (
              <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-4 animate-in fade-in zoom-in-95 duration-500">
                <div
                  className="h-20 w-20 rounded-full flex items-center justify-center
                    bg-primary/10 border-2 border-primary/30"
                >
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <p
                    className="text-xl font-bold text-slate-900 dark:text-white"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    File Uploaded
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                    <span className="text-primary font-semibold">
                      {state.fileName}
                    </span>{" "}
                    has been saved to the Company Library.
                  </p>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-600 mt-2">
                  Closing automatically…
                </p>
              </div>
            ) : (
              /* ── Form ──────────────────────────────────────────────────── */
              <form
                ref={formRef}
                action={handleSubmit}
                className="flex flex-col min-h-0 flex-1 overflow-hidden"
              >
                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto p-8 pt-5 space-y-5">
                  {/* Error Banner */}
                  {state?.error && (
                    <div
                      className="flex items-start gap-3 p-3.5 rounded-xl animate-in fade-in duration-300
                        bg-rose-50 border border-rose-200
                        dark:bg-rose-500/10 dark:border-rose-500/25"
                    >
                      <AlertCircle className="h-4 w-4 text-rose-500 dark:text-rose-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                        {state.error}
                      </p>
                    </div>
                  )}

                  {/* ── Drop Zone ──────────────────────────────────────── */}
                  <div
                    id="upload-drop-zone"
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                    }}
                    onDrop={handleDrop}
                    onClick={() =>
                      !selectedFile && fileInputRef.current?.click()
                    }
                    className={`relative rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden
                        ${
                          dragActive
                            ? "border-2 border-dashed border-primary bg-primary/5 dark:bg-primary/10"
                            : selectedFile
                              ? "border-2 border-solid border-primary/40 bg-primary/[0.03] dark:bg-primary/[0.07]"
                              : "border-2 border-dashed border-slate-200 hover:border-slate-300 bg-slate-50/50 dark:border-white/10 dark:hover:border-white/20 dark:bg-white/[0.02]"
                        }`}
                  >
                    {/* Hidden native input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="file-input"
                      name="file"
                      className="sr-only"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                    />

                    {selectedFile ? (
                      /* File Preview */
                      <div className="flex items-center gap-4 p-5">
                        <div
                          className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0
                            bg-primary/10 border border-primary/20"
                        >
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatBytes(selectedFile.size)} ·{" "}
                            {selectedFile.type || "Unknown type"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            if (fileInputRef.current)
                              fileInputRef.current.value = "";
                          }}
                          className="p-1.5 rounded-lg shrink-0 transition-all
                              text-slate-400 hover:text-rose-500 hover:bg-rose-50
                              dark:text-slate-500 dark:hover:text-rose-400 dark:hover:bg-rose-400/10"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      /* Idle Drop Target */
                      <div
                        className={`flex flex-col items-center justify-center gap-2.5 py-10 px-6 text-center transition-all duration-300 ${dragActive ? "scale-105" : ""}`}
                      >
                        <div
                          className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-1 transition-all
                            ${
                              dragActive
                                ? "bg-primary/15 border border-primary/40"
                                : "bg-slate-100 border border-slate-200 dark:bg-white/[0.04] dark:border-white/[0.06]"
                            }`}
                        >
                          <UploadCloud
                            className={`h-7 w-7 transition-colors ${dragActive ? "text-primary" : "text-slate-400 dark:text-slate-500"}`}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {dragActive
                              ? "Release to attach file"
                              : "Drag & drop your file here"}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            or{" "}
                            <span className="text-primary font-medium hover:text-primary-light transition-colors cursor-pointer">
                              browse to choose
                            </span>
                          </p>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">
                          PDF, DOCX, XLSX, PNG — max 50 MB
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ── Document Type ──────────────────────────────────── */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="doc_type"
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400"
                    >
                      <Tag className="h-3 w-3" />
                      Document Type <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="doc_type"
                        name="doc_type"
                        required
                        defaultValue=""
                        className="w-full appearance-none rounded-xl px-4 py-3 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all
                            text-slate-900 bg-slate-50 border border-slate-200 hover:border-slate-300
                            dark:text-white dark:bg-white/[0.04] dark:border-white/10 dark:hover:border-white/20"
                      >
                        <option
                          value=""
                          disabled
                          className="text-slate-400 bg-white dark:bg-[#071F15]"
                        >
                          Select folder destination…
                        </option>
                        {DOC_TYPE_OPTIONS.map((opt) => (
                          <option
                            key={opt.value}
                            value={opt.value}
                            className="bg-white dark:bg-[#071209] text-slate-900 dark:text-white"
                          >
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* ── Document Title ───────────────────────────────────── */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="label"
                      className="text-xs font-semibold uppercase tracking-widest block text-slate-500 dark:text-slate-400"
                    >
                      Document Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="label"
                      name="label"
                      type="text"
                      required
                      placeholder={'e.g. "Signed NDA" or "2024 Audit"'}
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all
                          text-slate-900 bg-slate-50 border border-slate-200 placeholder:text-slate-300 hover:border-slate-300
                          dark:text-white dark:bg-white/[0.04] dark:border-white/10 dark:placeholder:text-slate-700 dark:hover:border-white/20"
                    />
                  </div>

                  {/* ── Expiry Date ────────────────────────────────────── */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="expiry_date"
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400"
                    >
                      <CalendarDays className="h-3 w-3" />
                      Expiry Date{" "}
                      <span className="font-normal normal-case tracking-normal text-slate-400 dark:text-slate-600">
                        — optional
                      </span>
                    </label>
                    <input
                      id="expiry_date"
                      name="expiry_date"
                      type="date"
                      className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all
                          text-slate-900 bg-slate-50 border border-slate-200 hover:border-slate-300
                          dark:text-white dark:bg-white/[0.04] dark:border-white/10 dark:hover:border-white/20
                          [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>

                  {/* ── Notes ──────────────────────────────────────────── */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="notes"
                      className="text-xs font-semibold uppercase tracking-widest block text-slate-500 dark:text-slate-400"
                    >
                      Notes{" "}
                      <span className="font-normal normal-case tracking-normal text-slate-400 dark:text-slate-600">
                        — optional
                      </span>
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      rows={2}
                      placeholder="Any relevant notes about this document…"
                      className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all
                          text-slate-900 bg-slate-50 border border-slate-200 placeholder:text-slate-300 hover:border-slate-300
                          dark:text-white dark:bg-white/[0.04] dark:border-white/10 dark:placeholder:text-slate-700 dark:hover:border-white/20"
                    />
                  </div>
                </div>
                {/* end scrollable body */}

                {/* ── Pinned Action Bar (always visible) ─────────────── */}
                <div
                  className="flex items-center gap-3 px-8 py-5 shrink-0
                    border-t border-slate-100 dark:border-slate-800
                    bg-slate-50/80 dark:bg-transparent"
                >
                  <button
                    type="button"
                    onClick={handleClose}
                    id="upload-cancel-btn"
                    className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all
                        text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900
                        dark:text-slate-400 dark:border-slate-800 dark:hover:text-white dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="upload-submit-btn"
                    disabled={isPending || !selectedFile}
                    className="flex-[2] py-3 px-4 rounded-xl text-sm font-bold text-white transition-all
                        disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2
                        shadow-md hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5
                        disabled:shadow-none disabled:hover:translate-y-0"
                    style={{
                      background:
                        "linear-gradient(135deg, #0A5C3B 0%, #0c6a43 100%)",
                    }}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Uploading…</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-4 w-4" />
                        <span>Upload File</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
