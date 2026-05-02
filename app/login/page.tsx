import Image from "next/image";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[#071F15]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#0A5C3B_0%,transparent_70%)] opacity-[0.15]" />
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-[#0A5C3B] opacity-35 blur-3xl animate-blob" />
        <div className="absolute -right-40 top-60 h-96 w-96 rounded-full bg-[#0C6A43] opacity-25 blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-60 h-80 w-80 rounded-full bg-black opacity-15 blur-3xl animate-blob animation-delay-4000" />
        <div className="absolute right-20 -bottom-40 h-96 w-96 rounded-full bg-[#0A5C3B] opacity-25 blur-3xl animate-blob" />
        <div className="absolute inset-0 noise-overlay pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(10,92,59,0)_0%,rgba(7,31,21,0.4)_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="glass-card rounded-3xl p-8 shadow-2xl">
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center">
              <Image
                src="/logo.svg"
                alt="TelcoVantage Logo"
                width={64}
                height={64}
                priority
                draggable={false}
                className="select-none"
              />
            </div>
            <h1 className="font-plus-jakarta text-3xl font-bold tracking-[-0.05em] text-white">
              TelcoVantage Philippines
            </h1>
            <p className="mt-1 font-body text-sm tracking-wide text-slate-400">
              Management System
            </p>
          </div>

          <LoginForm />

          <div className="mt-6 text-center">
            <a
              href="#"
              className="font-body text-sm text-slate-300 hover:text-white transition-colors"
            >
              Forgot password?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
