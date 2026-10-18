"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MARKETING_NAV } from "@/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Logo } from "./logo";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => setOpen(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full",
        scrolled
          ? "border-b border-[#dce7ef] bg-[#f5f8fb]/90 backdrop-blur-xl"
          : "border-b border-transparent bg-[#f5f8fb]"
      )}
    >
      <div className="mx-auto flex h-[84px] max-w-[1380px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex">
          {MARKETING_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold",
                  active ? "text-[var(--color-action)]" : "text-[var(--color-text-secondary)] hover:text-[var(--foreground)]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button variant="primary" size="sm" asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-full)] border border-[var(--color-border)] text-[var(--foreground)]"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-surface)] md:hidden"
          >
            <div className="space-y-1 px-4 pb-4 pt-2">
              {MARKETING_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className={cn(
                    "block rounded-[var(--radius-lg)] px-4 py-3 text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-[var(--color-action-subtle)] text-[var(--color-action)]"
                      : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" size="md" asChild className="flex-1">
                  <Link href="/login" onClick={close}>Log in</Link>
                </Button>
                <Button variant="primary" size="md" asChild className="flex-1">
                  <Link href="/register" onClick={close}>Get started</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
