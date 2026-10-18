import type { LucideIcon } from "lucide-react";

export type TransactionStatus = "success" | "pending" | "failed";

export type TransactionType =
  | "airtime"
  | "data"
  | "broadband"
  | "electricity"
  | "cable"
  | "education"
  | "wallet-funding";

export interface Transaction {
  id: string;
  reference: string;
  type: TransactionType;
  title: string;
  description: string;
  amount: number;
  /** negative = money out, positive = money in */
  direction: "in" | "out";
  status: TransactionStatus;
  date: string; // ISO
  provider?: string;
  recipient?: string;
}

export interface Provider {
  id: string;
  name: string;
  /** tailwind color used for the avatar chip */
  color: string;
  short: string;
  image_url?: string | null;
}


export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  date: string; // ISO
  read: boolean;
  category: "transaction" | "promo" | "system" | "security";
}

export type UserRole = "user" | "admin";

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  avatarInitials: string;
  role: UserRole;
  walletBalance: number;
  memberSince: string;
}

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  color: string;
  bg?: string;
}

export interface StatCardData {
  label: string;
  value: string;
  change: number; // percentage
  icon: LucideIcon;
  accent: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  section?: string;
  children?: NavItem[];
}

export interface SpendingPoint {
  month: string;
  spending: number;
  funding: number;
}

export interface ExpenseSlice {
  name: string;
  value: number;
  color: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface Testimonial {
  name: string;
  role: string;
  quote: string;
  initials: string;
}

// --- Admin-only analytics ---

export interface AdminKpi {
  label: string;
  value: string;
  change: number; // percentage vs previous period
  icon: LucideIcon;
  accent: string;
}

export interface RevenuePoint {
  month: string;
  revenue: number; // platform fee revenue
  volume: number; // total transaction volume processed
}

export interface ServiceUsage {
  name: string;
  transactions: number;
  volume: number;
  color: string;
}

export interface ProviderShare {
  name: string;
  value: number; // percentage share of transactions
  color: string;
}
