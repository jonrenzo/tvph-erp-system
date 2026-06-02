import React, { Suspense } from "react";
import { validatePortalToken } from "@/app/portal/actions";
import PortalClient from "@/components/portal/portal-client";
import { ShieldAlert, LogIn, ArrowRight } from "lucide-react";
import Link from "next/link";

export const unstable_instant = {
  prefetch: "static",
  samples: [{ params: { token: "sample-token" } }],
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function PortalUploadPage({ params }: PageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-[#020b06] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-slate-500 animate-pulse">Loading secure upload portal...</p>
        </div>
      </div>
    }>
      <PortalUploadContent params={params} />
    </Suspense>
  );
}

async function PortalUploadContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await validatePortalToken(token);

  if (result.error || !result.success || !result.entity) {
    return (
      <div className="min-h-screen bg-[#020b06] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 opacity-20 blur-3xl w-96 h-96 bg-red-800 rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 opacity-20 blur-3xl w-96 h-96 bg-emerald-800 rounded-full" />

        <div className="max-w-md w-full bg-[#071F15] border border-red-950 rounded-3xl p-8 text-center relative z-10 shadow-2xl">
          <div className="h-16 w-16 rounded-2xl bg-red-950/30 border border-red-800/30 flex items-center justify-center text-red-500 mx-auto mb-6">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight font-plus-jakarta mb-2">
            Access Expired or Invalid
          </h1>
          
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            The secure document upload link you used is either invalid, has expired, or has already been revoked. Please request a new link from your TelcoVantage point of contact.
          </p>

          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-2xl py-3 font-semibold transition-all hover:shadow-lg hover:shadow-emerald-950/20 active:scale-95"
          >
            <LogIn className="h-5 w-5" />
            Staff Login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        
        <p className="text-[10px] text-emerald-900 mt-12 uppercase tracking-widest font-semibold">
          TelcoVantage Philippines Operational Security
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020b06] py-12 transition-colors duration-500">
      <PortalClient
        token={token}
        entityType={result.entityType as "vendor" | "customer"}
        entity={result.entity}
        initialDocuments={result.documents}
      />
    </div>
  );
}
