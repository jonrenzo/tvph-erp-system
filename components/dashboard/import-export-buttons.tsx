"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Upload } from "lucide-react";
import { ExportDropdown } from "@/components/dashboard/export-dropdown";

const ImportModal = dynamic(
  () => import("@/components/dashboard/import-modal").then((m) => m.ImportModal),
  { ssr: false },
);

type Props = {
  title: string;
  exportBaseUrl: string;
  importAction: (formData: FormData) => Promise<any>;
};

export function ImportExportButtons({ title, exportBaseUrl, importAction }: Props) {
  const [showImport, setShowImport] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowImport(true)}
          className="inline-flex items-center gap-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-900"
        >
          <Upload className="h-4 w-4" />
          Import
        </button>

        <ExportDropdown exportBaseUrl={exportBaseUrl} />
      </div>

      {showImport && (
        <ImportModal
          title={title}
          action={importAction}
          onClose={() => setShowImport(false)}
        />
      )}
    </>
  );
}
