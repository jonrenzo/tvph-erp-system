"use client";

import { useRef, useState, useCallback } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  X,
  Download,
} from "lucide-react";

type ImportResult = {
  created: number;
  updated: number;
  errors: { row: number; reason: string }[];
  columnMapping: Record<string, string>;
  unmappedColumns: string[];
  totalRows: number;
};

type Props = {
  title: string;
  action: (formData: FormData) => Promise<ImportResult | { error: string }>;
  onClose: () => void;
};

export function ImportModal({ title, action, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "uploading" | "result">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      setError("Please select a CSV or Excel (.xlsx) file.");
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
    setState("idle");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleImport = async () => {
    if (!file) return;
    setState("uploading");
    setError(null);

    const fd = new FormData();
    fd.set("file", file);

    const res = await action(fd);
    if ("error" in res && res.error) {
      setError(res.error);
      setState("idle");
    } else {
      setResult(res as ImportResult);
      setState("result");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Import {title}
          </h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {state === "result" && result ? (
            <ResultView result={result} onReset={() => { setState("idle"); setFile(null); setResult(null); }} />
          ) : (
            <>
              {!file ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-slate-300 dark:border-slate-600 hover:border-primary dark:hover:border-primary"
                  }`}
                >
                  <Upload className="h-8 w-8 mx-auto mb-3 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Drop your file here or click to browse
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports CSV and Excel (.xlsx) files
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => { setFile(null); setError(null); }}
                    className="text-xs text-slate-500 hover:text-red-500 transition-colors"
                  >
                    Change
                  </button>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!file || state === "uploading"}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {state === "uploading" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    "Start Import"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultView({
  result,
  onReset,
}: {
  result: ImportResult;
  onReset: () => void;
}) {
  const hasErrors = result.errors.length > 0;
  const hasUnmapped = result.unmappedColumns.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        <p className="text-base font-semibold text-slate-900 dark:text-white">
          Import completed
        </p>
      </div>

      {result.columnMapping && Object.keys(result.columnMapping).length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3">
          <p className="text-xs font-semibold uppercase text-slate-500 mb-2">
            Detected Column Mapping
          </p>
          <div className="space-y-1">
            {Object.entries(result.columnMapping).map(([fileCol, dbField]) => (
              <div key={fileCol} className="flex items-center gap-2 text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  {fileCol}
                </span>
                <span className="text-slate-400">→</span>
                <span className="text-primary font-mono">{dbField}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasUnmapped && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Unmapped columns
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              {result.unmappedColumns.join(", ")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {result.created}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
            Created
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {result.updated}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            Updated
          </p>
        </div>
        <div className={`rounded-xl p-3 text-center ${
          hasErrors
            ? "bg-red-50 dark:bg-red-900/20"
            : "bg-slate-50 dark:bg-slate-800/30"
        }`}>
          <p className={`text-2xl font-bold ${
            hasErrors
              ? "text-red-600 dark:text-red-400"
              : "text-slate-600 dark:text-slate-400"
          }`}>
            {result.errors.length}
          </p>
          <p className={`text-xs mt-0.5 ${
            hasErrors
              ? "text-red-600 dark:text-red-400"
              : "text-slate-500"
          }`}>
            Errors
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500 text-center">
        Processed {result.totalRows} row{result.totalRows !== 1 ? "s" : ""} total
      </p>

      {hasErrors && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 max-h-36 overflow-y-auto">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
            Errors
          </p>
          {result.errors.map((err, i) => (
            <p key={i} className="text-xs text-red-600 dark:text-red-400">
              Row {err.row}: {err.reason}
            </p>
          ))}
        </div>
      )}

      <button
        onClick={onReset}
        className="w-full px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-all"
      >
        Import Another File
      </button>
    </div>
  );
}
