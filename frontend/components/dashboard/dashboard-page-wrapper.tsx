"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/ui/page-transition";

export function DashboardPageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <PageTransition key={pathname}>
        {children}
      </PageTransition>
    </AnimatePresence>
  );
}
