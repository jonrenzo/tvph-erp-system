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
  ArrowLeft,
} from "lucide-react";
import { validateImportFile, ClientParsedResult } from "@/utils/client-import-parser";

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
  const [state, setState] = useState<"idle" | "preview" | "uploading" | "result">("idle");
  const [parsedData, setParsedData] = useState<ClientParsedResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      setError("Please select a CSV or Excel (.xlsx) file.");
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);

    try {
      const buffer = await f.arrayBuffer();
      const parsed = validateImportFile(buffer, title as "Customers" | "Vendors");
      setParsedData(parsed);
      setState("preview");
    } catch (err: any) {
      setError(err.message || "Failed to parse file client-side.");
      setState("idle");
      setFile(null);
    }
  }, [title]);

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
      setState("preview");
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
      <div className={`relative bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full ${state === "preview" ? "max-w-4xl" : "max-w-lg"} max-h-[90vh] flex flex-col overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95`}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            {state === "preview" && (
              <button
                onClick={() => {
                  setState("idle");
                  setFile(null);
                  setParsedData(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mr-1"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
              {state === "preview" ? `Preview Import Data (${title})` : `Import ${title}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {state === "result" && result ? (
            <ResultView
              result={result}
              onReset={() => {
                setState("idle");
                setFile(null);
                setParsedData(null);
                setResult(null);
              }}
            />
          ) : state === "preview" && parsedData ? (
            <PreviewView
              title={title}
              file={file!}
              parsedData={parsedData}
              state={state}
              error={error}
              onCancel={() => {
                setState("idle");
                setFile(null);
                setParsedData(null);
              }}
              onConfirm={handleImport}
            />
          ) : (
            <div className="space-y-4">
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
                    Drop your CSV or Excel file here or click to browse
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports CSV and Excel (.xlsx, .xls)
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
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewView({
  title,
  file,
  parsedData,
  state,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  file: File;
  parsedData: ClientParsedResult;
  state: string;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const hasErrors = parsedData.errors.length > 0;
  const fileHeaders = parsedData.rows.length > 0 ? Object.keys(parsedData.rows[0]) : [];
  const previewRows = parsedData.rows.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-[#0a0a0a]/30 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {file.name}
            </p>
            <p className="text-xs text-slate-500">
              {(file.size / 1024).toFixed(1)} KB • {parsedData.rows.length} total rows
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-500">Mapped:</span>
            <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 rounded font-mono font-semibold">
              {Object.keys(parsedData.columnMapping).length}
            </span>
          </div>
          {parsedData.unmappedColumns.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-500">Unmapped:</span>
              <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 rounded font-mono font-semibold">
                {parsedData.unmappedColumns.length}
              </span>
            </div>
          )}
        </div>
      </div>

      {hasErrors ? (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-400 font-semibold text-sm">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 animate-pulse" />
            Validation Errors Found ({parsedData.errors.length})
          </div>
          <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
            We found errors in your file structure. CSV/Excel import is strictly blocked until all validation errors are resolved. Please update your file and try re-uploading.
          </p>
          <div className="max-h-36 overflow-y-auto space-y-1.5 pl-2 border-t border-red-200 dark:border-red-900/50 pt-3">
            {parsedData.errors.map((err, i) => (
              <div key={i} className="text-xs text-red-700 dark:text-red-400 flex items-start gap-1 font-mono">
                <span className="font-bold text-red-800 dark:text-red-300 shrink-0">Row {err.row}:</span>
                <span>{err.reason}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">
              Format Validation Passed
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
              All records have passed local requirements. Review the preview below and confirm the import.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Row Preview (showing first 10 rows)
          </h3>
        </div>
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-[#0a0a0a]/20 max-h-[300px] overflow-y-auto">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-[#071f15]/50 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-500 font-mono w-16 text-center border-r border-slate-200 dark:border-slate-800">Row</th>
                {fileHeaders.map((header) => {
                  const dbField = parsedData.columnMapping[header];
                  return (
                    <th key={header} className="px-4 py-3 font-semibold min-w-[150px] border-r last:border-r-0 border-slate-200 dark:border-slate-800">
                      <div className="text-slate-800 dark:text-slate-200">{header}</div>
                      {dbField ? (
                        <span className="inline-block mt-1 text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/50 font-mono font-semibold">
                          → {dbField}
                        </span>
                      ) : (
                        <span className="inline-block mt-1 text-[9px] bg-slate-100 text-slate-500 dark:bg-slate-800/40 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/50 font-mono">
                          Ignored
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
              {previewRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/10">
                  <td className="px-4 py-3 text-slate-400 text-center font-bold border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 w-16">
                    {idx + 2}
                  </td>
                  {fileHeaders.map((header) => (
                    <td key={header} className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[220px] truncate border-r last:border-r-0 border-slate-200 dark:border-slate-800">
                      {row[header] !== undefined && row[header] !== null && String(row[header]).trim() !== "" ? (
                        String(row[header])
                      ) : (
                        <span className="text-slate-400/60 dark:text-slate-600 italic">empty</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm shrink-0"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={hasErrors || state === "uploading"}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm shadow-lg shadow-primary/20 active:scale-95"
        >
          {state === "uploading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing into DB...
            </>
          ) : (
            "Confirm & Import"
          )}
        </button>
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
        <CheckCircle2 className="h-6 w-6 text-emerald-500 animate-bounce" />
        <p className="text-base font-semibold text-slate-900 dark:text-white">
          Import completed
        </p>
      </div>

      {result.columnMapping && Object.keys(result.columnMapping).length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-200 dark:border-slate-800/50">
          <p className="text-xs font-semibold uppercase text-slate-500 mb-2">
            Detected Column Mapping
          </p>
          <div className="space-y-1">
            {Object.entries(result.columnMapping).map(([fileCol, dbField]) => (
              <div key={fileCol} className="flex items-center gap-2 text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/50 shadow-sm">
                  {fileCol}
                </span>
                <span className="text-slate-400">→</span>
                <span className="text-primary font-mono font-semibold">{dbField}</span>
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
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 font-mono">
              {result.unmappedColumns.join(", ")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {result.created}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
            Created
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {result.updated}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 font-medium">
            Updated
          </p>
        </div>
        <div className={`rounded-xl p-3 text-center border ${
          hasErrors
            ? "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30"
            : "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800"
        }`}>
          <p className={`text-2xl font-bold ${
            hasErrors
              ? "text-red-600 dark:text-red-400"
              : "text-slate-600 dark:text-slate-400"
          }`}>
            {result.errors.length}
          </p>
          <p className={`text-xs mt-0.5 font-medium ${
            hasErrors
              ? "text-red-600 dark:text-red-400"
              : "text-slate-500"
          }`}>
            Errors
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500 text-center font-medium">
        Processed {result.totalRows} row{result.totalRows !== 1 ? "s" : ""} total
      </p>

      {hasErrors && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-3 max-h-36 overflow-y-auto">
          <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
            Database Import Errors
          </p>
          {result.errors.map((err, i) => (
            <p key={i} className="text-xs text-red-600 dark:text-red-400 font-mono">
              Row {err.row}: {err.reason}
            </p>
          ))}
        </div>
      )}

      <button
        onClick={onReset}
        className="w-full px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-all shadow-md shadow-primary/10 text-sm active:scale-95"
      >
        Import Another File
      </button>
    </div>
  );
}
