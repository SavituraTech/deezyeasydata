const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/roles";

// Centralized prefix helpers — legacy is canonical today; v1 fallback kept for forward-compat.
// All paths below already include /api so API_PREFIX is informational only.
export const API_PREFIX = "/api";
export const API_V1_PREFIX = "/api/v1";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getClientToken(): string | null {
  return getCookie(ACCESS_TOKEN_COOKIE);
}

export function setClientTokens(access: string, refresh: string) {
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(access)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  document.cookie = `${REFRESH_TOKEN_COOKIE}=${encodeURIComponent(refresh)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function clearClientTokens() {
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${REFRESH_TOKEN_COOKIE}=; path=/; max-age=0`;
}

export function generateIdempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends Omit<RequestInit, "method" | "body" | "headers"> {
  method?: string;
  body?: unknown;
  token?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, idempotencyKey, signal, ...rest } = opts;

  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    h["Authorization"] = `Bearer ${token}`;
  }
  if (idempotencyKey) {
    h["Idempotency-Key"] = idempotencyKey;
    h["idempotency-key"] = idempotencyKey;
  }

  const fetchOpts: RequestInit = {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
    signal,
    ...rest,
  };

  const res = await fetch(`${API_BASE}${path}`, fetchOpts);

  if (res.status === 401 && !path.includes("/users/login/") && !path.includes("/users/register/") && !path.includes("/token/refresh")) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      h["Authorization"] = `Bearer ${refreshed}`;
      const retry = await fetch(`${API_BASE}${path}`, {
        method,
        headers: h,
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include",
        signal,
        ...rest,
      });
      if (retry.ok) {
        if (retry.status === 204) return undefined as T;
        return retry.json() as Promise<T>;
      }
      // if retry is 401 again, fall through to error handling
    }
  }

  if (!res.ok) {
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    const detail = (() => {
      if (!data || typeof data !== "object") return null;
      const rec = data as Record<string, unknown>;
      const raw = rec.detail ?? rec.message ?? rec.error ?? null;
      if (typeof raw === "string") return raw;
      if (raw && typeof raw === "object" && "message" in (raw as Record<string, unknown>)) {
        return String((raw as Record<string, unknown>).message);
      }
      // envelope {success:false, error:{message}}
      if (rec.success === false && rec.error && typeof rec.error === "object") {
        const e = rec.error as Record<string, unknown>;
        if (typeof e.message === "string") return e.message;
        if (typeof e.detail === "string") return e.detail;
      }
      return null;
    })();
    const msg = detail || `API error ${res.status}`;
    throw new ApiError(res.status, msg, data);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const REFRESH_CANDIDATES = ["/api/token/refresh/", "/api/users/refresh/", "/api/v1/auth/refresh/"];

async function tryRefreshToken(): Promise<string | null> {
  try {
    const refresh = getCookie(REFRESH_TOKEN_COOKIE);
    if (!refresh) return null;
    for (const p of REFRESH_CANDIDATES) {
      try {
        const res = await fetch(`${API_BASE}${p}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ refresh }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const newAccess = data.access ?? data.data?.access ?? null;
        if (newAccess) {
          document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(newAccess)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
          return newAccess;
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function clientFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; idempotencyKey?: string; signal?: AbortSignal } = {}
): Promise<T> {
  const token = getClientToken();
  // Support httpOnly cookies via credentials:"include" when token is absent; still require token for
  // JS-accessible path but allow retry without token if cookies are httpOnly.
  if (!token) {
    // Attempt unauthenticated fetch with credentials — backend may accept cookie auth.
    // If backend requires Bearer, request will 401 and propagate.
    return request<T>(path, { ...opts });
  }
  return request<T>(path, { ...opts, token });
}

// ── Token types ──────────────────────────────────────────────

export interface TokenPair {
  access: string;
  refresh: string;
}

// ── Auth API ─────────────────────────────────────────────────

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  name: string;
  role: "ADMIN" | "USER";
  is_superuser: boolean;
  status: string;
  balance: string;
  airtime_limit: string;
  payment_gateway_limit: string;
  has_atm_access: boolean;
  has_web_access: boolean;
  has_app_access: boolean;
  date_joined: string;
  last_login: string | null;
  id_type: "bvn" | "nin" | null;
  id_number: string | null;
}

export const authApi = {
  login(username: string, password: string) {
    // Backend returns {success:true, data:{tokens:{access,refresh}}} envelope (DBN parity)
    return request<{ access: string; refresh: string } | { success: boolean; data: { tokens: TokenPair; user?: ApiUser } }>("/api/users/login/", {
      method: "POST",
      body: { username, password },
    }).then((r: unknown) => {
      const rec = r as Record<string, unknown>;
      if (rec && typeof rec === "object" && "success" in rec && (rec as { success: boolean }).success && "data" in rec) {
        const d = (rec as { data: { tokens: TokenPair } }).data;
        if (d?.tokens) return d.tokens;
      }
      if ("tokens" in (r as object)) return (r as { tokens: TokenPair }).tokens;
      return r as TokenPair;
    });
  },

  register(data: { username: string; phone: string; email?: string; password: string; password_confirm?: string }) {
    return request<{ access: string; refresh: string } | { success: boolean; data: { tokens: TokenPair } }>("/api/users/register/", {
      method: "POST",
      body: data,
    }).then((r: unknown) => {
      const rec = r as Record<string, unknown>;
      if (rec && typeof rec === "object" && "success" in rec && "data" in rec) {
        const d = (rec as { data: { tokens: TokenPair } }).data;
        if (d?.tokens) return d.tokens;
      }
      if ("tokens" in (r as object)) return (r as { tokens: TokenPair }).tokens;
      return r as TokenPair;
    });
  },

  me(token: string) {
    // Backend MeView returns UserSerializer directly; ProfileView returns envelope.
    return request<ApiUser | { success: boolean; data: ApiUser }>("/api/users/me/", { token }).then((r) => {
      const rec = r as unknown as Record<string, unknown>;
      if (rec && typeof rec === "object" && "success" in rec && "data" in rec) return (rec as { data: ApiUser }).data as ApiUser;
      return r as ApiUser;
    });
  },

  logout(refresh: string) {
    // No server logout endpoint currently; blacklist via SimpleJWT is optional. Clear client side.
    // Attempt to hit blacklist if available, otherwise resolve.
    return request<{ success: boolean }>("/api/token/blacklist/", {
      method: "POST",
      body: { refresh },
    }).catch(() => ({ success: true }));
  },

  refresh(refresh: string) {
    return request<{ access: string }>("/api/token/refresh/", {
      method: "POST",
      body: { refresh },
    });
  },

  // DBN-compatible ProfileUpdate (name/email/phone) — falls back to legacy first_name/last_name
  updateProfile(token: string, data: { name?: string; first_name?: string; last_name?: string; email?: string; phone?: string; id_type?: "bvn" | "nin"; id_number?: string }) {
    // Prefer new profile endpoint which accepts name/email/phone
    return request<ApiUser | { success: boolean; data: ApiUser }>("/api/users/profile/", { method: "PATCH", body: data, token })
      .then((r) => {
        const rec = r as unknown as Record<string, unknown>;
        if (rec && typeof rec === "object" && "success" in rec && "data" in rec) return (rec as { data: ApiUser }).data as ApiUser;
        return r as ApiUser;
      })
      .catch(() => request<ApiUser>("/api/users/me/profile/", { method: "PATCH", body: data, token }));
  },

  changePassword(token: string, data: { old_password: string; new_password: string }) {
    return request<unknown>("/api/users/me/password/", { method: "POST", body: data, token });
  },
};

// ── Wallet API ───────────────────────────────────────────────

export interface WalletBalance {
  balance: string;
  cashback_balance: string;
}

export interface LedgerEntry {
  reference: string;
  amount: string;
  balance_before: string;
  balance_after: string;
  description: string;
  entry_type: string;
  created_at: string;
}

export interface VirtualAccount {
  id: number;
  provider: "PAYMENTPOINT" | "PAYVESSEL";
  account_number: string;
  account_name: string;
  bank_name: string;
  is_active: boolean;
  created_at: string;
}

export const walletApi = {
  balance(token: string) {
    return request<WalletBalance>("/api/wallets/", { token });
  },

  ledger(token: string) {
    return request<LedgerEntry[]>("/api/wallets/ledger/", { token });
  },

  virtualAccount(token: string) {
    return request<VirtualAccount | null>("/api/wallets/virtual-account/", { token }).then((r) => (r as unknown as VirtualAccount | null) ?? null);
  },

  virtualAccounts(token: string) {
    return request<VirtualAccount[]>("/api/wallets/virtual-account/?all=true", { token });
  },

  createVirtualAccount(token: string, provider: "PAYVESSEL") {
    return request<VirtualAccount>("/api/wallets/virtual-account/", {
      method: "POST",
      body: { provider, force_new: true },
      token,
    });
  },

  deposit(token: string, amount: string, provider: "payvessel" = "payvessel") {
    return request<{ success: boolean; data: { payment_reference: string; amount: string; status: string; transaction_id: number; payment?: { authorization_url?: string } } }>("/api/wallets/initiate-deposit/", {
      method: "POST",
      body: provider ? { amount, provider } : { amount },
      token,
    });
  },

  verifyDeposit(token: string) {
    return request<ApiTransaction>("/api/wallets/", { token });
  },

  paymentProviders(token: string) {
    return request<{ success: boolean; default_provider: "payvessel"; providers: { id: "payvessel"; name: string; description: string; available: boolean }[] }>("/api/wallets/payment-providers/", { token });
  },

  withdrawCashback(token: string, amount?: string) {
    return request<{ success: boolean; message: string; new_balance: string }>("/api/wallets/withdraw-cashback/", {
      method: "POST",
      body: amount ? { amount } : {},
      token,
    }).catch(() =>
      request<{ success: boolean; message: string; new_balance: string }>("/api/wallets/cashback/withdraw/", {
        method: "POST",
        body: amount ? { amount } : {},
        token,
      })
    );
  },
};

// ── Transactions API ─────────────────────────────────────────

export interface ApiTransaction {
  id: number;
  amount: string;
  transaction_type: string;
  status: string;
  target: string;
  product_name: string;
  description: string;
  provider_reference: string | null;
  is_refunded: boolean;
  refunded_at: string | null;
  refund_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiTransactionDetail extends ApiTransaction {
  provider_request: unknown;
  provider_response: unknown;
}

export const transactionsApi = {
  list(token: string, params?: { search?: string; type?: string; status?: string; page?: number; page_size?: number }) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.type) qs.set("type", params.type);
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    const q = qs.toString();
    return request<PaginatedResponse<ApiTransaction>>(`/api/transactions/history/${q ? `?${q}` : ""}`, { token });
  },

  detail(token: string, id: number) {
    return request<ApiTransactionDetail>(`/api/transactions/history/${id}/`, { token });
  },

  orderStatus(token: string, id: number) {
    return request<{ success: boolean; data: { transaction: ApiTransactionDetail } }>(`/api/transactions/order-status/${id}/`, { token });
  },
};

// ── Products API ─────────────────────────────────────────────

export type ProductCategory = "AIRTIME" | "DATA" | "SME_DATA" | "ELECTRICITY" | "CABLE" | "BROADBAND" | "EDUCATION" | "STREAMING";

export interface ApiProduct {
  id: number;
  name: string;
  category: ProductCategory;
  network: string | null;
  provider: string;
  provider_product_code: string;
  cost_price: string;
  selling_price: string;
  commission: string;
  margin: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  cashback_enabled: boolean;
  cashback_rate_percent: string | null;
  data_size: string | null;
  data_validity: string | null;
  plan_group: string | null;
  created_at: string;
  updated_at: string;
}

export const productsApi = {
  list(token: string) {
    return request<ApiProduct[]>("/api/products/", { token });
  },

  sync(token: string, data?: { dry_run?: boolean; apply_images?: boolean; deactivate_missing?: boolean }) {
    return request<{ [key: string]: unknown }>("/api/products/admin/", {
      method: "POST",
      body: data ?? {},
      token,
    });
  },
};

// ── Providers API ─────────────────────────────────────────────

export interface ProviderMetadata {
  icon_url?: string;
  logo_url?: string;
  color?: string;
  [key: string]: unknown;
}

export interface ApiVirtualAccount {
  id: number;
  provider: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApiProvider {
  id: number;
  name: string;
  slug: string;
  base_url: string;
  timeout_seconds: number;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  supported_services: unknown;
  metadata: ProviderMetadata;
  created_at: string;
  updated_at: string;
}

export const providersApi = {
  list(token: string) {
    return request<ApiProvider[]>("/api/providers/", { token });
  },

  health(token: string) {
    return request<ApiProvider[]>("/api/providers/admin/health-summary/", { token });
  },
};

// ── Buy API ──────────────────────────────────────────────────

export interface BuyResponse {
  success: boolean;
  data: {
    transaction: ApiTransaction;
    message: string;
    cashback_amount: string;
  };
}

export const buyApi = {
  airtime(data: { product_id?: number; network?: string; amount?: number; phone: string; use_cashback?: boolean }, opts?: { idempotencyKey?: string; signal?: AbortSignal }) {
    return clientFetch<BuyResponse>("/api/transactions/buy-airtime/", { method: "POST", body: data, idempotencyKey: opts?.idempotencyKey ?? generateIdempotencyKey(), signal: opts?.signal });
  },

  data(data: { product_id: number; phone: string }, opts?: { idempotencyKey?: string; signal?: AbortSignal }) {
    return clientFetch<BuyResponse>("/api/transactions/buy-data/", { method: "POST", body: data, idempotencyKey: opts?.idempotencyKey ?? generateIdempotencyKey(), signal: opts?.signal });
  },

  electricity(data: { product_id: number; meter_number: string; amount: string; meter_type: "prepaid" | "postpaid"; customer_name?: string }, opts?: { idempotencyKey?: string; signal?: AbortSignal }) {
    return clientFetch<BuyResponse>("/api/transactions/buy-electricity/", { method: "POST", body: data, idempotencyKey: opts?.idempotencyKey ?? generateIdempotencyKey(), signal: opts?.signal });
  },

  cable(data: { product_id: number; smartcard_number: string; customer_name?: string }, opts?: { idempotencyKey?: string; signal?: AbortSignal }) {
    return clientFetch<BuyResponse>("/api/transactions/buy-cable/", { method: "POST", body: data, idempotencyKey: opts?.idempotencyKey ?? generateIdempotencyKey(), signal: opts?.signal });
  },

  broadband(data: { product_id: number; account_number: string; customer_name?: string }, opts?: { idempotencyKey?: string; signal?: AbortSignal }) {
    return clientFetch<BuyResponse>("/api/transactions/buy-broadband/", { method: "POST", body: data, idempotencyKey: opts?.idempotencyKey ?? generateIdempotencyKey(), signal: opts?.signal });
  },

  education(data: { product_id: number; quantity?: number }, opts?: { idempotencyKey?: string; signal?: AbortSignal }) {
    return clientFetch<BuyResponse>("/api/transactions/buy-education/", { method: "POST", body: data, idempotencyKey: opts?.idempotencyKey ?? generateIdempotencyKey(), signal: opts?.signal });
  },

  verifyMeter(data: { meter_number: string; meter_type: "prepaid" | "postpaid"; disco_code: string }) {
    return clientFetch<{ success: boolean; data: { customer_name: string; meter_number: string; disco_code: string } }>("/api/transactions/verify-meter/", { method: "POST", body: data });
  },

  verifySmartcard(data: { smartcard_number: string; cable_provider: string }) {
    return clientFetch<{ success: boolean; data: { customer_name: string; smartcard_number: string } }>("/api/transactions/verify-smartcard/", { method: "POST", body: data });
  },

  verifyBroadband(data: { account_number: string; broadband_provider: string }) {
    return clientFetch<{ success: boolean; data: { customer_name: string; account_number: string } }>("/api/transactions/verify-broadband/", { method: "POST", body: data });
  },

  orderStatus(id: number) {
    return clientFetch<{ success: boolean; data: { transaction: ApiTransactionDetail } }>(`/api/transactions/order-status/${id}/`);
  },
};

// ── Admin API ────────────────────────────────────────────────

export interface AdminStats {
  total_users: number;
  active_users: number;
  total_transactions: number;
  today_transactions?: number;
  today_revenue?: string;
  week_revenue?: string;
  month_revenue?: string;
  // Backend new shape: array of {status,count} or legacy Record
  transactions_by_status: Record<string, number> | Array<{ status: string; count: number }>;
  transactions_by_type: Record<string, number> | Array<{ type: string; count: number; revenue: string }>;
  // New analytics also include totals
  total_volume?: string | number;
  success_transactions?: number;
  total_products?: number;
}

export interface AdminAnalyticsDaily {
  date: string;
  day?: string;
  transactions: number;
  count?: number;
  revenue: string;
}

export interface AdminAnalyticsResponse {
  daily?: AdminAnalyticsDaily[];
  daily_revenue_series?: Array<{ day: string; count: number; revenue: string }>;
  daily_signups_series?: Array<{ day: string; count: number }>;
  transactions_by_status?: Array<{ status: string; count: number }>;
  transactions_by_type?: Array<{ type: string; count: number; revenue: string }>;
  period_kpis?: Record<string, unknown>;
  period_days?: number;
}

export interface AdminTopProduct {
  name: string;
  count: number;
  revenue: string;
}

export interface AdminTopProductsResponse {
  top_products: AdminTopProduct[];
}

export interface PaginatedResponse<T> {
  count: number;
  page: number;
  results: T[];
}

export interface AdminTransactionListParams {
  status?: string;
  type?: string;
  user_id?: number;
  refunded?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface AdminAuditLogEntry {
  id: number;
  admin: string;
  action: string;
  transaction_id: number | null;
  target_user: string | null;
  note: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type WalletAdjustmentStatus = "PENDING_APPROVAL" | "APPLIED" | "REJECTED";

export interface ApiWalletAdjustment {
  id: number;
  user: number;
  user_username: string;
  admin: number;
  admin_username: string;
  approved_by: number | null;
  approved_by_username: string | null;
  type: "CREDIT" | "DEBIT";
  source: "WALLET" | "CASHBACK";
  amount: string;
  reason: string;
  status: WalletAdjustmentStatus;
  reference: string | null;
  balance_before: string | null;
  balance_after: string | null;
  can_approve: boolean;
  created_at: string;
  decided_at: string | null;
  ip_address: string | null;
}

export interface WalletAdjustmentList extends PaginatedResponse<ApiWalletAdjustment> {
  pending_count: number;
}

export interface AdminAuditLogParams {
  action?: string;
  transaction_id?: number;
  admin_id?: number;
  page?: number;
  page_size?: number;
}

export const adminApi = {
  stats(token: string) {
    return request<AdminStats>("/api/users/admin/stats/", { token });
  },

  analytics(token: string, days = 30) {
    // Backend canonical uses period param (7,30,90), fallback to days for compat
    return request<AdminAnalyticsResponse>(`/api/users/admin/analytics/?period=${days}&days=${days}`, { token });
  },

  topProducts(token: string, days = 30, limit = 10) {
    return request<AdminTopProductsResponse>(`/api/users/admin/top-products/?days=${days}&limit=${limit}`, { token });
  },

  platformFees(token: string) {
    return request<unknown>("/api/users/admin/settings/platform-fees/", { token });
  },

  platformKyc(token: string) {
    return request<PlatformKyc>("/api/users/admin/settings/platform-kyc/", { token });
  },

  updatePlatformKyc(token: string, data: Pick<PlatformKyc, "id_type" | "id_number">) {
    return request<PlatformKyc>("/api/users/admin/settings/platform-kyc/", { method: "PUT", body: data, token });
  },

  users(token: string, params?: { search?: string; role?: string; is_active?: boolean; page?: number; page_size?: number }) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.role) qs.set("role", params.role);
    if (params?.is_active !== undefined) qs.set("is_active", String(params.is_active));
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    const query = qs.toString();
    return request<PaginatedResponse<ApiUser>>(`/api/users/admin/users/${query ? `?${query}` : ""}`, { token });
  },

  userDetail(token: string, userId: number) {
    return request<ApiUser>(`/api/users/admin/users/${userId}/`, { token });
  },

  createUser(token: string, data: { username: string; phone: string; email?: string; password: string; role?: string }) {
    return request<ApiUser>("/api/users/admin/users/", { method: "POST", body: data, token });
  },

  updateUser(token: string, userId: number, data: { first_name?: string; last_name?: string; email?: string; phone?: string; role?: string; is_active?: boolean }) {
    return request<ApiUser>(`/api/users/admin/users/${userId}/`, { method: "PATCH", body: data, token });
  },

  deleteUser(token: string, userId: number) {
    return request<void>(`/api/users/admin/users/${userId}/`, { method: "DELETE", token });
  },

  suspendUser(token: string, userId: number) {
    return request<{ message: string; is_active: boolean }>(`/api/users/admin/users/${userId}/suspend/`, { method: "POST", body: {}, token });
  },

  clearLogins(token: string, userId: number) {
    return request<{ message: string }>(`/api/users/admin/users/${userId}/clear-logins/`, { method: "POST", body: {}, token });
  },

  resetUserPassword(token: string, userId: number, newPassword: string) {
    return request<{ message: string }>(`/api/users/admin/users/${userId}/reset-password/`, {
      method: "POST",
      body: { new_password: newPassword },
      token,
    });
  },

  resetUserPin(token: string, userId: number, newPin: string) {
    return request<{ message: string }>(`/api/users/admin/users/${userId}/reset-pin/`, {
      method: "POST",
      body: { new_pin: newPin },
      token,
    });
  },

  updateUserLimits(token: string, userId: number, data: { has_atm_access?: boolean; has_web_access?: boolean; has_app_access?: boolean; airtime_limit?: string; payment_gateway_limit?: string }) {
    return request<ApiUser>(`/api/users/admin/users/${userId}/limits/`, { method: "PATCH", body: data, token });
  },

  walletTransaction(
    token: string,
    userId: number,
    data: {
      amount: string;
      type: "CREDIT" | "DEBIT";
      reason: string;
      source?: "WALLET" | "CASHBACK";
      idempotency_key?: string;
    },
  ) {
    return request<{
      message: string;
      status: "APPLIED" | "PENDING_APPROVAL" | "REJECTED";
      reference: string | null;
      balance_after: string | null;
      replayed: boolean;
    }>(`/api/users/admin/users/${userId}/wallet-transaction/`, {
      method: "POST",
      body: data,
      token,
    });
  },

  walletAdjustments(token: string, params?: { status?: WalletAdjustmentStatus; user_id?: number; page?: number; page_size?: number }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.user_id) qs.set("user_id", String(params.user_id));
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    const query = qs.toString();
    return request<WalletAdjustmentList>(`/api/users/admin/wallet-adjustments/${query ? `?${query}` : ""}`, { token });
  },

  decideWalletAdjustment(token: string, id: number, decision: "approve" | "reject") {
    return request<{ message: string; status: WalletAdjustmentStatus }>(
      `/api/users/admin/wallet-adjustments/${id}/${decision}/`,
      { method: "POST", token },
    );
  },

  transactions(token: string, params?: AdminTransactionListParams) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.type) qs.set("type", params.type);
    if (params?.user_id) qs.set("user_id", String(params.user_id));
    if (params?.refunded !== undefined) qs.set("refunded", String(params.refunded));
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    const query = qs.toString();
    return request<PaginatedResponse<ApiTransaction>>(`/api/transactions/admin/${query ? `?${query}` : ""}`, { token });
  },

  transactionDetail(token: string, txnId: number) {
    return request<ApiTransactionDetail>(`/api/transactions/admin/${txnId}/`, { token });
  },

  resolveTransaction(token: string, txnId: number, data: { action: "success" | "fail" | "refund"; note: string; provider_reference?: string }) {
    return request<{ success: boolean; message: string; transaction_id: number; status: string; is_refunded: boolean; refund_reference: string | null }>(
      `/api/transactions/admin/${txnId}/resolve/`,
      { method: "POST", body: data, token }
    );
  },

  bulkRefund(token: string, data: { transaction_ids: number[]; note: string }) {
    return request<{ success: boolean; refunded_count: number; refunded_ids: number[]; skipped_ids: number[]; errors: string[] }>(
      "/api/transactions/admin/bulk-refund/",
      { method: "POST", body: data, token }
    );
  },

  auditLog(token: string, params?: AdminAuditLogParams) {
    const qs = new URLSearchParams();
    if (params?.action) qs.set("action", params.action);
    if (params?.transaction_id) qs.set("transaction_id", String(params.transaction_id));
    if (params?.admin_id) qs.set("admin_id", String(params.admin_id));
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    const query = qs.toString();
    return request<PaginatedResponse<AdminAuditLogEntry>>(`/api/transactions/admin/audit-log/${query ? `?${query}` : ""}`, { token });
  },

  exportData(token: string, dataset: string) {
    return request<unknown>(`/api/users/admin/exports/${dataset}/`, { token });
  },

  // ── Products admin ───────────────────────────────────────────

  products(token: string, params?: { search?: string; category?: string; network?: string; provider?: string; is_active?: boolean; page?: number; page_size?: number }) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.category) qs.set("category", params.category);
    if (params?.network) qs.set("network", params.network);
    if (params?.provider) qs.set("provider", params.provider);
    if (params?.is_active !== undefined) qs.set("is_active", String(params.is_active));
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    const query = qs.toString();
    return request<PaginatedResponse<ApiProduct>>(`/api/products/admin/${query ? `?${query}` : ""}`, { token });
  },

  createProduct(token: string, data: Partial<ApiProduct>) {
    return request<ApiProduct>("/api/products/admin/", { method: "POST", body: data, token });
  },

  updateProduct(token: string, productId: number, data: Partial<ApiProduct>) {
    return request<ApiProduct>(`/api/products/admin/${productId}/`, { method: "PATCH", body: data, token });
  },

  deleteProduct(token: string, productId: number) {
    return request<{ detail?: string }>(`/api/products/admin/${productId}/`, { method: "DELETE", token });
  },

  productDetail(token: string, productId: number) {
    return request<ApiProduct>(`/api/products/admin/${productId}/`, { token });
  },

  // ── User virtual accounts ───────────────────────────────────

  userVirtualAccounts(token: string, userId: number) {
    return request<ApiVirtualAccount[]>(`/api/users/admin/users/${userId}/accounts/`, { token });
  },

  createUserVirtualAccount(token: string, userId: number, provider: "PAYVESSEL" = "PAYVESSEL") {
    return request<ApiVirtualAccount>(`/api/users/admin/users/${userId}/create-account/`, {
      method: "POST",
      body: provider ? { provider } : {},
      token,
    });
  },
};

// ── Wallet Config API ─────────────────────────────────────────

export interface WalletConfig {
  funding_charge: string;
  cashback_rate_percent: string;
  cashback_rate_by_category: Record<string, string>;
  paymentpoint_enabled: boolean;
  payvessel_enabled: boolean;
  default_payment_provider: "payvessel";
  updated_at: string;
}

export interface PlatformKyc {
  id_type: "bvn" | "nin" | null;
  id_number: string | null;
  updated_at: string;
}

export const walletConfigApi = {
  get(token: string) {
    return request<WalletConfig>("/api/wallets/admin/config/", { token });
  },

  update(token: string, data: Partial<WalletConfig>) {
    return request<WalletConfig>("/api/wallets/admin/config/", { method: "PATCH", body: data, token });
  },
};

// ── Notification API ──────────────────────────────────────────

export interface ApiNotification {
  id: number;
  admin: string;
  title: string;
  message: string;
  segment: string;
  recipient_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NotificationBroadcastParams {
  title: string;
  message: string;
  segment: string;
  threshold?: number;
  min_transactions?: number;
}

export const notificationApi = {
  broadcast(token: string, data: NotificationBroadcastParams) {
    return request<ApiNotification>("/api/notifications/admin/broadcast/", { method: "POST", body: data, token });
  },

  list(token: string, params?: { page?: number; page_size?: number }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    const query = qs.toString();
    return request<PaginatedResponse<ApiNotification>>(`/api/notifications/${query ? `?${query}` : ""}`, { token });
  },
};

async function requestBlob(path: string, opts: { method?: string; token?: string } = {}): Promise<Blob> {
  const { method = "GET", token } = opts;
  const h: Record<string, string> = {};
  if (token) h["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method, headers: h, credentials: "include" });
  if (!res.ok) {
    let data: unknown;
    try { data = await res.json(); } catch { data = null; }
    const detail = data && typeof data === "object" && "detail" in data
      ? String((data as { detail: unknown }).detail)
      : null;
    throw new ApiError(res.status, detail || `API error ${res.status}`, data);
  }
  return res.blob();
}

export async function downloadExport(token: string, dataset: string): Promise<Blob> {
  return requestBlob(`/api/users/admin/exports/${dataset}/`, { token });
}
