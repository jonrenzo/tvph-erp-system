"use client";

import { useState } from "react";
import { 
  UserPlus, 
  X, 
  Mail, 
  Shield, 
  User, 
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export function AddUserButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    password: "",
    role: "user"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // In a real implementation, this would call a Server Action
      // that uses the Supabase Admin API to invite the user.
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
        setIsOpen(false);
        setSuccess(false);
        setFormData({ email: "", fullName: "", password: "", role: "user" });
        window.location.reload(); // Refresh the list
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
      >
        <UserPlus className="h-5 w-5" />
        Add Team Member
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#071F15] w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <UserPlus className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white font-plus-jakarta">Add Team Member</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {success ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">Invitation Sent!</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {formData.email} has been added to the team.
                    </p>
                  </div>
                </div>
              ) : (
                <>
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
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
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
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Temporary Password</label>
                    <div className="relative">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        required
                        type="text"
                        placeholder="e.g. Telco2024!"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">System Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'admin', label: 'Admin' },
                        { id: 'finance', label: 'Finance' },
                        { id: 'procurement', label: 'Procurement' },
                        { id: 'project_manager', label: 'PM' },
                        { id: 'user', label: 'Standard' },
                      ].map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, role: role.id })}
                          className={`py-2 px-3 text-[10px] font-bold rounded-xl border transition-all ${
                            formData.role === role.id
                              ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-primary/50'
                          }`}
                        >
                          {role.label.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400">
                      <AlertCircle className="h-5 w-5 shrink-0" />
                      <p className="text-xs font-medium">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-4 py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 shadow-xl shadow-primary/20"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "Send Invite"
                    )}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
