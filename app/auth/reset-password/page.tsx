import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
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
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-7 w-7 text-primary"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <h1 className="font-plus-jakarta text-2xl font-bold tracking-tighter text-white">
              Set New Password
            </h1>
            <p className="mt-1 font-body text-sm tracking-wide text-slate-400 text-center">
              You must change your password before continuing
            </p>
          </div>

          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}
