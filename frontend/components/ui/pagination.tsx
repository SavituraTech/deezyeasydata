"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => {
    return p === 1 || p === totalPages || Math.abs(p - page) <= 1;
  });

  const items: (number | "…")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) items.push("…");
    items.push(p);
  });

  return (
    <nav className={cn("flex items-center justify-center gap-1", className)} aria-label="Pagination">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {items.map((item, i) =>
        item === "…" ? (
          <span key={`e-${i}`} className="px-2 text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={item}
            onClick={() => onPageChange(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              "flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors",
              item === page
                ? "border-navy bg-[var(--color-primary)] text-white dark:border-yellow dark:bg-[var(--color-accent)] dark:text-[var(--color-primary)]"
                : "border-border text-foreground hover:bg-muted"
            )}
          >
            {item}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
