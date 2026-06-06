"use client";

import { useState } from "react";
import { Download, Loader2, AlertCircle } from "lucide-react";

export function GenerateReportButton({ href }: { href: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const handleClick = async () => {
    setState("loading");
    try {
      const res = await fetch(href, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`${res.status}`);

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");

      // Use the filename the server provides, if any.
      const cd    = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download  = match?.[1] ?? "report.pdf";
      a.href      = url;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);

      setState("idle");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  const isError   = state === "error";
  const isLoading = state === "loading";

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-60 ${
        isError
          ? "bg-red-500 hover:bg-red-600 text-white"
          : "bg-primary hover:bg-primary/90 text-white"
      }`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isError ? (
        <AlertCircle className="h-4 w-4" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isLoading ? "Generating…" : isError ? "Failed — retry?" : "Download PDF"}
    </button>
  );
}
