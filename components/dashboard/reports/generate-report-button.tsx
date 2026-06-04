"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

/**
 * Opens a report PDF route in a new tab. Shows a brief pending state so the user
 * gets feedback while the server generates the document.
 */
export function GenerateReportButton({ href }: { href: string }) {
  const [pending, setPending] = useState(false);

  const handleClick = () => {
    setPending(true);
    window.open(href, "_blank", "noopener,noreferrer");
    // The PDF renders in the new tab; clear the local pending state shortly after.
    setTimeout(() => setPending(false), 1500);
  };

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {pending ? "Generating…" : "Generate PDF"}
    </button>
  );
}
