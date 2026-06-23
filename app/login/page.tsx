import Image from "next/image";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');
  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes panelIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .anim-panel   { animation: panelIn 0.9s ease forwards; }
        .anim-fade-up { animation: fadeUp  0.55s ease forwards; opacity: 0; }
        .anim-d1 { animation-delay: 0.08s; }
        .anim-d2 { animation-delay: 0.18s; }
        .anim-d3 { animation-delay: 0.28s; }
        .anim-d4 { animation-delay: 0.38s; }
        .anim-d5 { animation-delay: 0.48s; }
        .anim-d6 { animation-delay: 0.58s; }
      `}</style>

      <div className="flex min-h-screen">
        {/* ── Left brand panel ─────────────────────────────────── */}
        <div
          className="hidden lg:flex lg:w-[42%] xl:w-[40%] relative flex-col justify-between overflow-hidden anim-panel"
          style={{
            background:
              "linear-gradient(148deg,#0d6b45 0%,#0a5c3b 45%,#063322 100%)",
          }}
        >
          {/* Dot grid */}
          <div className="absolute inset-0 pointer-events-none select-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id="dotgrid"
                  x="0"
                  y="0"
                  width="28"
                  height="28"
                  patternUnits="userSpaceOnUse"
                >
                  <circle
                    cx="1.5"
                    cy="1.5"
                    r="1.5"
                    fill="white"
                    fillOpacity="0.09"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dotgrid)" />
            </svg>
          </div>

          {/* Signal rings — top-right corner */}
          <div className="absolute -top-20 -right-20 pointer-events-none select-none">
            <svg width="360" height="360" viewBox="0 0 360 360" fill="none">
              <circle
                cx="360"
                cy="0"
                r="110"
                stroke="white"
                strokeWidth="1"
                strokeOpacity="0.09"
              />
              <circle
                cx="360"
                cy="0"
                r="175"
                stroke="white"
                strokeWidth="1"
                strokeOpacity="0.065"
              />
              <circle
                cx="360"
                cy="0"
                r="248"
                stroke="white"
                strokeWidth="1"
                strokeOpacity="0.04"
              />
            </svg>
          </div>

          {/* Bottom-left accent arc */}
          <div className="absolute -bottom-24 -left-24 pointer-events-none select-none">
            <svg width="260" height="260" viewBox="0 0 260 260" fill="none">
              <circle
                cx="0"
                cy="260"
                r="90"
                stroke="white"
                strokeWidth="1"
                strokeOpacity="0.07"
              />
              <circle
                cx="0"
                cy="260"
                r="145"
                stroke="white"
                strokeWidth="1"
                strokeOpacity="0.045"
              />
            </svg>
          </div>

          {/* Top: logo + wordmark */}
          <div className="relative z-10 p-10 pt-11">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.svg"
                alt="TelcoVantage Philippines"
                width={30}
                height={30}
                priority
                draggable={false}
                className="select-none"
              />
              <span
                className="font-sans text-[10px] font-bold tracking-[0.22em] uppercase select-none"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                TelcoVantage Philippines
              </span>
            </div>
          </div>

          {/* Centre: tagline */}
          <div className="relative z-10 px-10 pb-4">
            <div
              className="w-7 mb-7"
              style={{ height: "2px", background: "rgba(255,255,255,0.28)" }}
            />
            <h2
              className="font-sans font-bold leading-[1.07] tracking-tight mb-5 select-none"
              style={{
                fontSize: "clamp(2rem,3.2vw,2.75rem)",
                color: "rgba(255,255,255,0.97)",
              }}
            >
              Enterprise
              <br />
              Operations,
              <br />
              Unified.
            </h2>
            <p
              className="font-body text-sm leading-relaxed select-none"
              style={{ color: "rgba(255,255,255,0.4)", maxWidth: "260px" }}
            >
              TelcoVantage Philippines <br />
              Internal ERP System.
            </p>
          </div>

          {/* Bottom: metadata */}
          <div
            className="relative z-10 px-10 py-8 flex items-center justify-between"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span
              className="font-body text-[10px] font-semibold tracking-[0.18em] uppercase select-none"
              style={{ color: "rgba(255,255,255,0.22)" }}
            >
              ERP System
            </span>
            <span
              className="font-body text-[10px] select-none"
              style={{ color: "rgba(255,255,255,0.22)" }}
            >
              © 2026 TVPH
            </span>
          </div>
        </div>

        {/* ── Right form panel ──────────────────────────────────── */}
        <div
          className="flex-1 flex items-center justify-center px-8 py-14"
          style={{ background: "#FAFAF5" }}
        >
          <div className="w-full max-w-[368px]">
            {/* Mobile logo (hidden on desktop — shown on left panel) */}
            <div className="flex items-center justify-center gap-2.5 mb-10 lg:hidden">
              <Image
                src="/logo.svg"
                alt="TelcoVantage"
                width={26}
                height={26}
                priority
                draggable={false}
                className="select-none"
              />
              <span className="font-sans text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 select-none">
                TelcoVantage Philippines
              </span>
            </div>

            {/* Heading */}
            <div className="mb-8 anim-fade-up anim-d1">
              <div
                className="w-5 h-[2.5px] rounded-full mb-5"
                style={{ background: "#0a5c3b" }}
              />
              <h1 className="font-sans text-[1.7rem] font-bold text-gray-900 leading-tight tracking-tight mb-1.5">
                Welcome back
              </h1>
              <p className="font-body text-sm text-gray-400">
                Sign in to continue to your workspace
              </p>
            </div>

            {/* Form */}
            <Suspense>
              <LoginForm />
            </Suspense>

            {/* Forgot password */}
            <div className="mt-5 text-center anim-fade-up anim-d6">
              <a
                href="#"
                className="font-body text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                Forgot password?
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
