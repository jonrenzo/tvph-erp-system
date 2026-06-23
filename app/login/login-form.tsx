"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "./actions";
import { createClient } from "@/utils/supabase/client";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "oauth_failed"
      ? "Microsoft sign-in failed. Please try again or use email and password."
      : null
  );
  const [isPending, startTransition] = useTransition();
  const [isMsoPending, setIsMsoPending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  const handleMicrosoftSignIn = async () => {
    setError(null);
    setIsMsoPending(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "openid email profile https://graph.microsoft.com/User.Read",
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setIsMsoPending(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-body text-sm text-gray-900 placeholder:text-gray-300 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10";

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Email */}
      <div className="anim-fade-up anim-d2">
        <label htmlFor="email" className="block font-body text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@telcovantage.com"
          className={inputClass}
        />
      </div>

      {/* Password */}
      <div className="anim-fade-up anim-d3">
        <label htmlFor="password" className="block font-body text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={`${inputClass} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 transition-colors hover:text-gray-500 focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4.5 w-4.5 h-[18px] w-[18px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-[18px] w-[18px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Sign In */}
      <div className="pt-1 anim-fade-up anim-d4">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl py-2.5 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 focus:ring-offset-[#FAFAF5] disabled:opacity-50"
          style={{ background: "#0a5c3b" }}
        >
          {isPending ? "Signing in…" : "Sign In"}
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 anim-fade-up anim-d4">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="font-body text-[10px] text-gray-400 tracking-wider">OR</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Microsoft SSO */}
      <div className="anim-fade-up anim-d5">
        <button
          type="button"
          onClick={handleMicrosoftSignIn}
          disabled={isMsoPending || isPending}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-gray-200 bg-white py-2.5 font-body text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-[#FAFAF5] disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" className="h-4 w-4 shrink-0" aria-hidden="true">
            <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
            <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
            <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          {isMsoPending ? "Redirecting…" : "Sign in with Microsoft"}
        </button>
      </div>
    </form>
  );
}
