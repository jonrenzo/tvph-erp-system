"use client";

import { useState } from "react";
import { User, Mail, Lock, Shield, Save, Camera, CheckCircle2 } from "lucide-react";
import { updateProfile, requestPasswordReset, updateAvatar } from "@/app/dashboard/profile/actions";

export function ProfileForm({ profile, userEmail }: { profile: any, userEmail: string }) {
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdate = async (formData: FormData) => {
    setIsSaving(true);
    setMessage(null);
    const result = await updateProfile(formData);
    setIsSaving(false);
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to update profile.' });
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append('file', file);

    const result = await updateAvatar(formData);
    setIsUploading(false);

    if (result.success) {
      setMessage({ type: 'success', text: 'Avatar updated successfully!' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to upload avatar.' });
    }
  };

  const handlePasswordReset = async () => {
    setIsResetting(true);
    setMessage(null);
    const result = await requestPasswordReset();
    setIsResetting(false);

    if (result.success) {
      setMessage({ type: 'success', text: 'Password reset link sent to your email!' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to send reset link.' });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Avatar & Summary */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center text-center">
          <div className="relative group">
            <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold ring-4 ring-white dark:ring-slate-800 shadow-xl overflow-hidden">
              {isUploading ? (
                <span className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                profile?.full_name?.charAt(0) || 'U'
              )}
            </div>
            <label className="absolute bottom-0 right-0 p-1.5 bg-primary text-white rounded-full border-2 border-white dark:border-slate-800 shadow-md transform hover:scale-110 transition-transform cursor-pointer">
              <Camera className="h-4 w-4" />
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
            </label>
          </div>
          <h3 className="mt-4 font-bold text-slate-900 dark:text-white text-lg">{profile?.full_name}</h3>
          <p className="text-xs text-slate-500">{userEmail}</p>
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest">
            <Shield className="h-3 w-3" />
            {profile?.role || 'User'}
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-2xl p-4">
          <p className="text-[10px] text-amber-800 dark:text-amber-500 leading-relaxed font-medium">
            Your role determines what modules you can access. To change your role, please contact a System Administrator in the Organization Settings.
          </p>
        </div>
      </div>

      {/* Right Column: Form */}
      <div className="lg:col-span-2 space-y-6">
        {message && (
          <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
            message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
          }`}>
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}

        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl p-8">
          <form action={handleUpdate}>
            <h4 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> General Information
            </h4>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Name</label>
                <input
                  name="full_name"
                  required
                  defaultValue={profile?.full_name}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1.5 opacity-60">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
                <input
                  readOnly
                  defaultValue={userEmail}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none cursor-not-allowed"
                />
                <p className="text-[10px] text-slate-400 italic">Email can only be changed via security verification.</p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button 
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                {isSaving ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
                Update Profile
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl p-8">
          <h4 className="font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> Security
          </h4>
          <div className="space-y-4 text-center py-4">
            <p className="text-sm text-slate-500">Need to update your password?</p>
            <button 
              onClick={handlePasswordReset}
              disabled={isResetting}
              className="px-6 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isResetting && <span className="h-3 w-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
              Send Password Reset Email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
