"use client";

import { useState, useRef, useTransition } from "react";
import { ScanLine, X, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { extractInvoiceFromFile } from "@/app/dashboard/invoices/actions";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface ExtractResult {
  success: boolean;
  stagedPath: string;
  stagedFileName: string;
  extracted: Record<string, any> | null;
  vendorMatch: { id: string; name: string; matchedBy: "tin" | "name"; score?: number } | null;
  poMatch: { id: string; vendor_id: string } | null;
  ocrWarning?: string;
  error?: string;
}

interface Props {
  onExtracted: (result: ExtractResult) => void;
  onCleared: () => void;
  stagedFileName?: string;
}

export function InvoiceOcrUpload({ onExtracted, onCleared, stagedFileName }: Props) {
  const [isPending, startTransition] = useTransition();
  const [clientError, setClientError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    setClientError(null);

    if (file.size > MAX_FILE_SIZE) {
      setClientError("File exceeds the 10MB limit.");
      return;
    }
    const mimeByExt: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = file.type || mimeByExt[ext] || "";
    if (!ALLOWED_MIME.includes(mime)) {
      setClientError("Only PDF, JPEG, PNG, or WebP files are accepted.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await extractInvoiceFromFile(formData);
      if ("error" in result && result.error) {
        setClientError(result.error as string);
      } else {
        onExtracted(result as ExtractResult);
      }
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (isPending) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  if (stagedFileName) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-sm">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="flex-1 text-emerald-700 dark:text-emerald-300 font-medium truncate">
          Extracted from <span className="font-semibold">{stagedFileName}</span> — review before saving
        </span>
        <button
          type="button"
          onClick={onCleared}
          className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors shrink-0"
          title="Remove scan"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor="ocr-upload"
        onDragOver={(e) => { e.preventDefault(); if (!isPending) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex items-center justify-center gap-3 w-full px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
          isPending
            ? "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/20"
            : isDragging
            ? "border-primary bg-primary/10 dark:bg-primary/20"
            : "border-primary/30 hover:border-primary/60 hover:bg-primary/5 dark:hover:bg-primary/10"
        }`}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
            <span className="text-sm text-slate-500">Extracting data…</span>
          </>
        ) : (
          <>
            <ScanLine className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              {isDragging ? "Drop to scan" : "Drag & drop or click to scan (PDF / image)"}
            </span>
          </>
        )}
        <input
          ref={inputRef}
          id="ocr-upload"
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={isPending}
          onChange={handleFileChange}
        />
      </label>

      {clientError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-lg text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {clientError}
        </div>
      )}
    </div>
  );
}
