"use client";

import React, { useState } from "react";
import { generateMagicLink } from "@/app/dashboard/portal/actions";
import { Link2, Copy, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface GenerateLinkButtonProps {
  entityId: string;
  entityType: "vendor" | "customer";
}

export default function GenerateLinkButton({
  entityId,
  entityType
}: GenerateLinkButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await generateMagicLink(entityId, entityType);
      if (result.error) {
        toast.error(`Failed to generate portal link: ${result.error}`);
      } else if (result.portalUrl) {
        setPortalUrl(result.portalUrl);
        toast.success("Portal link generated successfully!", {
          icon: <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
        });
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      {portalUrl ? (
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 pl-3 transition-all animate-in fade-in slide-in-from-left-2 duration-300">
          <span className="text-xs font-mono text-slate-500 max-w-[160px] truncate">
            {portalUrl}
          </span>
          <button
            onClick={handleCopy}
            className="p-2 bg-primary hover:bg-primary/95 text-white rounded-lg transition-all active:scale-95 flex items-center justify-center"
            title="Copy portal URL"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setPortalUrl(null)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Generate new link"
          >
            <Link2 className="h-3.5 w-3.5 rotate-45" />
          </button>
        </div>
      ) : (
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 bg-emerald-800/10 border border-emerald-800/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-800/20 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4" />
              Generate Portal Link
            </>
          )}
        </button>
      )}
    </div>
  );
}
