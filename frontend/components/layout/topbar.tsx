"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Menu, Search, LogOut, Settings, ShieldCheck, User, ChevronDown } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRole } from "@/components/dashboard/role-context";
import { logoutAction } from "@/app/(auth)/login/actions";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { isAdmin, user } = useRole();
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const initials = getInitials(user.name || user.username);
  const displayName = user.first_name || user.name || user.username;
  const firstName = displayName.split(" ")[0];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (q) {
      router.push(`/dashboard/transactions?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/dashboard/transactions");
    }
    setSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center bg-[var(--background)]/80 px-4 backdrop-blur-xl sm:px-6">
      {/* Left: mobile menu + greeting */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--muted)] text-[var(--foreground)]"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      <div className="hidden lg:block">
        <p className="text-sm font-medium text-[var(--foreground)]">{getGreeting()}, {firstName}</p>
        <p className="text-xs text-[var(--color-text-secondary)]">Here&apos;s what&apos;s happening today</p>
      </div>

      {/* Right: actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* Search - desktop */}
        <form onSubmit={handleSearch} className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-10 w-48 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--muted)]/50 pl-10 pr-3 text-sm text-[var(--foreground)] placeholder:text-[var(--color-text-secondary)] focus:w-64 focus:border-[var(--color-border-focus)] focus:bg-[var(--color-surface)] focus:outline-none transition-all duration-[var(--duration-base)]"
          />
        </form>

        {/* Search - mobile toggle */}
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--muted)] text-[var(--color-text-secondary)] hover:text-[var(--foreground)] md:hidden"
        >
          <Search className="h-4 w-4" />
        </button>

        <ThemeToggle className="h-9 w-9 rounded-[var(--radius-md)] border-0 bg-[var(--muted)] text-[var(--color-text-secondary)] hover:text-[var(--foreground)]" />

        <Link
          href="/dashboard/notifications"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--muted)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--foreground)]"
        >
          <Bell className="h-4 w-4" />
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--muted)] py-1 pl-1 pr-2.5 transition-colors hover:bg-[var(--muted)]/80">
              <Avatar className="h-8 w-8 rounded-[var(--radius-md)]">
                <AvatarFallback className="rounded-[var(--radius-md)] bg-[var(--color-action-subtle)] text-xs font-semibold text-[var(--color-action)]">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:block">{firstName}</span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-[var(--color-text-secondary)] sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[var(--foreground)]">{user.name || user.username}</p>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--color-action)]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-action)]">
                    <ShieldCheck className="h-3 w-3" />
                    Admin
                  </span>
                )}
              </div>
              <p className="truncate text-xs font-normal text-[var(--color-text-secondary)]">
                {user.email || user.username}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <User /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
                <Settings /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <button
                onClick={() => logoutAction()}
                className="w-full text-[var(--color-error)] cursor-pointer"
              >
                <LogOut /> Log out
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile search bar - expands below */}
      {searchOpen && (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-[var(--color-border)] bg-[var(--background)] p-3 md:hidden">
          <form onSubmit={handleSearch} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions, services…"
              autoFocus
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--muted)] pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
          </form>
        </div>
      )}
    </header>
  );
}
