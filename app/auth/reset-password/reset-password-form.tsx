"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "./actions";

export function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("new_password", newPassword);
      formData.append("confirm_password", confirmPassword);
      const result = await resetPassword(formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        router.push("/dashboard");
      }
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-500 border border-red-500/20">
          {error}
        </div>
      )}
      <div>
        <label
          htmlFor="new_password"
          className="block font-body text-sm font-medium text-slate-300"
        >
          New Password
        </label>
        <input
          id="new_password"
          name="new_password"
          type={showPassword ? "text" : "password"}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="••••••••"
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2.5 font-body text-sm text-white placeholder:text-slate-500 focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div>
        <label
          htmlFor="confirm_password"
          className="block font-body text-sm font-medium text-slate-300"
        >
          Confirm Password
        </label>
        <input
          id="confirm_password"
          name="confirm_password"
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2.5 font-body text-sm text-white placeholder:text-slate-500 focus:border-primary-light focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="show-password"
          type="checkbox"
          checked={showPassword}
          onChange={(e) => setShowPassword(e.target.checked)}
          className="rounded border-slate-700 bg-slate-900/50 text-primary focus:ring-primary/20"
        />
        <label htmlFor="show-password" className="text-xs text-slate-400">
          Show passwords
        </label>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-primary py-2.5 font-body text-sm font-semibold text-white transition-colors hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
      >
        {isPending ? "Setting password..." : "Set New Password"}
      </button>
    </form>
  );
}
