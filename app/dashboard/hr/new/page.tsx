"use client";

import { useState } from "react";
import { UserPlus, Mail, Shield, User, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AddEmployeePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    password: "",
    role: "viewer"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/hr/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to invite user");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard/hr");
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/hr"
          className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Add Team Member
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Invite a new employee and set up their profile.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {success ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">Invitation Sent!</p>
                <p className="text-slate-500 mt-2">
                  {formData.email} has been added to the team. Redirecting...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      required
                      type="text"
                      placeholder="John Doe"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      required
                      type="email"
                      placeholder="john@telcovantage.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Temporary Password</label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    required
                    type="text"
                    placeholder="e.g. Telco2026!"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none font-mono"
                  />
                </div>
                <p className="text-xs text-slate-500 ml-1">They will be prompted to change this on their first login.</p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">System Role</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { id: 'admin', label: 'Admin', desc: 'Director — runs the business' },
                    { id: 'finance', label: 'Finance', desc: 'Invoices, payments, accounting' },
                    { id: 'operations', label: 'Operations', desc: 'Vendors, POs, projects, CRM' },
                    { id: 'viewer', label: 'Viewer', desc: 'Read-only access' },
                  ].map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, role: role.id })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        formData.role === role.id
                          ? 'bg-primary/5 border-primary text-primary shadow-sm'
                          : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-primary/30'
                      }`}
                    >
                      <div className="text-sm font-bold">{role.label}</div>
                      <div className={`text-[10px] mt-0.5 ${formData.role === role.id ? 'text-primary/70' : 'text-slate-500'}`}>
                        {role.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                  {isLoading ? "Inviting..." : "Send Invitation"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
