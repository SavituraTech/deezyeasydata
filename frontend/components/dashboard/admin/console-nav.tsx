"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "@/constants";

export function ConsoleNav() {
  const pathname = usePathname();

  // Find the current active page
  const activeItem = ADMIN_NAV.find((item) =>
    item.href === "/dashboard/admin"
      ? pathname === "/dashboard/admin"
      : pathname.startsWith(item.href)
  );

  if (!activeItem) return null;

  // Build breadcrumb items
  const breadcrumbItems = [{ label: "Admin Console", href: "/dashboard/admin" }];
  if (activeItem.href !== "/dashboard/admin") {
    breadcrumbItems.push({ label: activeItem.label, href: activeItem.href });
  }

  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground">
      {breadcrumbItems.map((item, index) => (
        <span key={item.href} className="flex items-center gap-2">
          {index > 0 && <span className="text-muted-foreground/50">/</span>}
          <Link
            href={item.href}
            className={cn(
              "transition-colors hover:text-foreground",
              index === breadcrumbItems.length - 1 && "text-foreground font-medium"
            )}
          >
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
