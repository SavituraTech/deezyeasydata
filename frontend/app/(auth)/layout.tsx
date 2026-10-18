import Link from "next/link";
import { ShieldCheck, Zap, Wallet } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-[#f3f7fa] lg:grid-cols-[.9fr_1.1fr]">
      {/* Brand panel */}
      <div className="relative m-4 hidden overflow-hidden rounded-[30px] bg-[#062f4c] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 data-rings opacity-[.12]" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-72 w-72 rounded-full bg-[#69d535]/20 blur-3xl" />

        <div className="relative">
          <Logo href="/" className="text-white" />
        </div>

        <div className="relative max-w-md">
          <div className="mb-6 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/65">One account. Every connection.</div>
          <h2 className="text-5xl font-extrabold leading-[1.02] tracking-[-.05em]">
            Easy payments.<br/><span className="text-[#78e342]">Zero detours.</span>
          </h2>
          <p className="mt-4 text-lg text-white/70">
            Pay bills, buy airtime and manage your money with Deezy Easy Data.
          </p>

          <ul className="mt-10 space-y-5">
            {[
              { icon: Zap, text: "Instant airtime, data and bill payments" },
              { icon: ShieldCheck, text: "Bank-grade security and encryption" },
              { icon: Wallet, text: "One wallet for everything, with auto refunds" },
            ].map((f) => (
              <li key={f.text} className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0878cf]">
                  <f.icon className="h-5 w-5" />
                </span>
                <span className="text-sm text-white/80">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/40">&copy; {new Date().getFullYear()} Deezy Easy Data</p>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-col bg-[#f3f7fa] dark:bg-[var(--background)]">
        <div className="flex items-center justify-between p-6 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-dark)]">
            <Logo className="w-auto" showText={false} />
          </div>
          <ThemeToggle />
        </div>
        <div className="hidden items-center justify-between p-6 lg:flex">
          <div />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <p className="p-6 text-center text-xs text-[var(--color-text-secondary)]">
          By continuing you agree to our{" "}
          <Link href="/faqs" className="text-[var(--foreground)] font-medium hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/faqs" className="text-[var(--foreground)] font-medium hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
