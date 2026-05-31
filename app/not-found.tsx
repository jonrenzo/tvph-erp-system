"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-background text-foreground font-sans">
      {/* Background Elements */}
      <div className="noise-overlay absolute inset-0 z-0 pointer-events-none" />
      
      {/* Animated Blobs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob z-0 dark:mix-blend-screen" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-primary-light/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000 z-0 dark:mix-blend-screen" />
      <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-emerald-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000 z-0 dark:mix-blend-screen" />

      {/* Content Card */}
      <div className="relative z-10 p-8 md:p-12 max-w-lg w-full mx-4 glass-card rounded-2xl flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-primary" />
        </div>
        
        <h1 className="text-6xl font-bold tracking-tight mb-2 text-slate-900 dark:text-white">
          404
        </h1>
        
        <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-100">
          Page Not Found
        </h2>
        
        <p className="text-slate-600 dark:text-slate-400 mb-8 font-body leading-relaxed">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>

        <div className="flex flex-col sm:flex-row w-full gap-4 justify-center">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-primary text-white hover:bg-primary-light transition-colors duration-200 font-medium"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
