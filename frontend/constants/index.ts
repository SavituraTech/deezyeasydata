import {
  LayoutDashboard,
  Wallet,
  Smartphone,
  Wifi,
  Zap,
  Tv,
  GraduationCap,
  Globe,
  Receipt,
  Bell,
  User,
  Settings,
  Shield,
  Store,
  Users,
  ArrowLeftRight,
  Package,
  Server,
  Download,
  FileText,
  ShieldCheck,
} from "lucide-react";
import type { NavItem, QuickAction } from "@/types";

export const SITE = {
  name: "Deezy Easy Data",
  tagline: "Stay connected. Stay easy.",
  email: "hello@deezyeasydata.com",
  phone: "+234 800 000 0000",
  address: "12 Marina Road, Lagos, Nigeria",
};

export const MARKETING_NAV = [
  { label: "Why Us", href: "/#why-us" },
  { label: "Services", href: "/#services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "FAQs", href: "/faqs" },
];

export const DASHBOARD_NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, section: "main" },
  { label: "Fund Wallet", href: "/dashboard/wallet", icon: Wallet, section: "main" },
  { label: "Products", href: "/dashboard/products", icon: Store, section: "main" },
  { label: "Data", href: "/dashboard/data", icon: Wifi, section: "services" },
  { label: "Airtime", href: "/dashboard/airtime", icon: Smartphone, section: "services" },
  { label: "Electricity", href: "/dashboard/electricity", icon: Zap, section: "services" },
  { label: "Cable TV", href: "/dashboard/cable-tv", icon: Tv, section: "services" },
  { label: "Education", href: "/dashboard/education", icon: GraduationCap, section: "services" },
  { label: "Broadband", href: "/dashboard/broadband", icon: Globe, section: "services" },
  { label: "Transactions", href: "/dashboard/transactions", icon: Receipt, section: "account" },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell, section: "account" },
  { label: "Profile", href: "/dashboard/profile", icon: User, section: "account" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, section: "account" },
  {
    label: "Admin Console",
    href: "/dashboard/admin",
    icon: Shield,
    adminOnly: true,
    section: "admin",
    children: [
      { label: "Overview", href: "/dashboard/admin", icon: LayoutDashboard },
      { label: "Users", href: "/dashboard/admin/users", icon: Users },
      { label: "Transactions", href: "/dashboard/admin/transactions", icon: ArrowLeftRight },
      { label: "Approvals", href: "/dashboard/admin/approvals", icon: ShieldCheck },
      { label: "Products", href: "/dashboard/admin/products", icon: Package },
      { label: "Providers", href: "/dashboard/admin/providers", icon: Server },
      { label: "Notifications", href: "/dashboard/admin/notifications", icon: Bell },
      { label: "Settings", href: "/dashboard/admin/settings", icon: Settings },
      { label: "Export", href: "/dashboard/admin/export", icon: Download },
      { label: "Audit Log", href: "/dashboard/admin/audit-log", icon: FileText },
    ],
  },
];

export const ADMIN_NAV: NavItem[] = DASHBOARD_NAV.find(
  (item) => item.href === "/dashboard/admin"
)?.children || [];

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Data", href: "/dashboard/data", icon: Wifi, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" },
  { label: "Airtime", href: "/dashboard/airtime", icon: Smartphone, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  { label: "Electricity", href: "/dashboard/electricity", icon: Zap, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  { label: "Cable TV", href: "/dashboard/cable-tv", icon: Tv, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" },
  { label: "Education", href: "/dashboard/education", icon: GraduationCap, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
  { label: "Broadband", href: "/dashboard/broadband", icon: Globe, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10" },
];

export const AIRTIME_PRESETS = [100, 200, 500, 1000, 2000, 5000];
export const FUNDING_PRESETS = [1000, 2000, 5000, 10000, 20000, 50000];
