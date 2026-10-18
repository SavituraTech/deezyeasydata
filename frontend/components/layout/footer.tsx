import Link from "next/link";
import { SITE } from "@/constants";
import { Logo } from "./logo";

const SERVICES = [
  { label: "Buy Airtime", href: "/dashboard/airtime" },
  { label: "Buy Data", href: "/dashboard/data" },
  { label: "Electricity Bills", href: "/dashboard/electricity" },
  { label: "Cable TV", href: "/dashboard/cable-tv" },
  { label: "Broadband", href: "/dashboard/broadband" },
  { label: "Education PINs", href: "/dashboard/education" },
];

const ACCOUNT = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Wallet", href: "/dashboard/wallet" },
  { label: "Transactions", href: "/dashboard/transactions" },
  { label: "Settings", href: "/dashboard/settings" },
];

const COMPANY = [
  { label: "About Us", href: "/about" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Features", href: "/#features" },
  { label: "FAQs", href: "/faqs" },
];

const SUPPORT = [
  { label: "Contact Us", href: "/contact" },
  { label: "Email Support", href: `mailto:${SITE.email}` },
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
];

export function Footer() {
  return (
    <footer className="relative bg-[#0B1120] text-white pt-20 pb-8 overflow-hidden">
      {/* Glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--color-secondary)]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[var(--color-secondary)]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 lg:px-8">
        {/* Main footer grid */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-8 mb-16">
          {/* Brand */}
          <div className="md:col-span-4">
            <Logo variant="tag" showText={false} className="mb-6" />
            <p className="text-gray-400 leading-relaxed mb-6 max-w-xs text-sm">
              The most reliable bill vending and data subscription platform for
              urban professionals.
            </p>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <a
                href={`mailto:${SITE.email}`}
                className="hover:text-white transition-colors"
              >
                {SITE.email}
              </a>
            </div>
          </div>

          {/* Services */}
          <div className="md:col-span-2">
            <h4 className="mb-6 text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
              Services
            </h4>
            <ul className="space-y-3">
              {SERVICES.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div className="md:col-span-2">
            <h4 className="mb-6 text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
              Account
            </h4>
            <ul className="space-y-3">
              {ACCOUNT.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="md:col-span-2">
            <h4 className="mb-6 text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
              Company
            </h4>
            <ul className="space-y-3">
              {COMPANY.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div className="md:col-span-2">
            <h4 className="mb-6 text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
              Support
            </h4>
            <ul className="space-y-3">
              {SUPPORT.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.06] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <span className="w-1 h-1 rounded-full bg-gray-700" />
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
