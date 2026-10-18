"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DASHBOARD_NAV } from "@/constants";
import { cn } from "@/lib/utils";
import { useRole } from "@/components/dashboard/role-context";
import { logoutAction } from "@/app/(auth)/login/actions";
import { Logo } from "./logo";
import type { NavItem } from "@/types";

const SECTIONS: { key: string; label: string }[] = [
  { key: "main", label: "Overview" },
  { key: "services", label: "Services" },
  { key: "account", label: "Account" },
  { key: "admin", label: "Administration" },
];

function NavItemLink({ item, onNavigate, depth = 0 }: { item: NavItem; onNavigate?: () => void; depth?: number }) {
  const pathname = usePathname();
  const active =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.href);
  const Icon = item.icon;

  if (item.children) {
    // Parent item with children — expand children when active
    const isExpanded = active && item.children.some((child) =>
      child.href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname.startsWith(child.href)
    );

    return (
      <div>
        <Link
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold",
            active
              ? "bg-white text-[#062f4c] shadow-[0_8px_20px_rgba(0,0,0,.14)]"
              : "text-white/60 hover:bg-white/8 hover:text-white"
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5 shrink-0 transition-colors",
              active ? "text-[#0878cf]" : "text-white/45 group-hover:text-white"
            )}
          />
          <span className="flex-1">{item.label}</span>
          {item.adminOnly && (
            <span
              className={cn(
                "rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                active
                  ? "bg-[#e8f3ff] text-[#0878cf]"
                  : "bg-white/10 text-white/60"
              )}
            >
              Admin
            </span>
          )}
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              isExpanded && "rotate-90"
            )}
          />
        </Link>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="ml-4 mt-1 space-y-0.5 border-l border-white/12 pl-3">
                {item.children.map((child) => (
                  <NavItemLink key={child.href} item={child} onNavigate={onNavigate} depth={depth + 1} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold",
        active
          ? "bg-white text-[#062f4c] shadow-[0_8px_20px_rgba(0,0,0,.14)]"
          : "text-white/60 hover:bg-white/8 hover:text-white"
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-colors",
          active ? "text-[#0878cf]" : "text-white/45 group-hover:text-white"
        )}
      />
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { isAdmin } = useRole();

  const items = DASHBOARD_NAV.filter((item) => !item.adminOnly || isAdmin);

  const grouped = React.useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of items) {
      const sec = item.section || "main";
      const list = map.get(sec) || [];
      list.push(item);
      map.set(sec, list);
    }
    return map;
  }, [items]);

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar space-y-6">
      {SECTIONS.map((section) => {
        const sectionItems = grouped.get(section.key);
        if (!sectionItems?.length) return null;
        return (
          <div key={section.key}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-white/30">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {sectionItems.map((item) => (
                <NavItemLink key={item.href} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="border-t border-white/10 px-3 py-3">
      <button
        onClick={() => logoutAction()}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-white/50 hover:bg-white/8 hover:text-white"
      >
        <LogOut className="h-5 w-5" />
        Log out
      </button>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col overflow-hidden bg-[#062f4c] lg:flex">
      <div className="pointer-events-none absolute -left-20 top-28 h-56 w-56 rounded-full bg-[#0878cf]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-0 h-48 w-48 rounded-full bg-[#69d535]/10 blur-3xl" />
      <div className="relative flex h-[80px] items-center border-b border-white/10 px-5">
        <Logo href="/dashboard" />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col"><NavLinks /><SidebarFooter /></div>
    </aside>
  );
}

export function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-[var(--color-primary-dark)]/50 backdrop-blur-sm lg:hidden"
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#062f4c] lg:hidden"
          >
            <div className="flex h-[72px] items-center justify-between border-b border-white/10 px-5">
              <Logo href="/dashboard" />
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavLinks onNavigate={onClose} />
            <SidebarFooter />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
