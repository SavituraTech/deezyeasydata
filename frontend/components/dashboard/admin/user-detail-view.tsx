"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Building2,
  CreditCard,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  Copy,
  Check,
  ShieldCheck,
  UserCog,
  Mail,
  Phone,
  Calendar,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFetch } from "@/hooks/use-api";
import { adminApi, getClientToken } from "@/lib/api";
import { formatNaira, formatDateTime, formatDate } from "@/lib/utils";
import type { ApiUser, ApiVirtualAccount } from "@/lib/api";

export function UserDetailView({ userId }: { userId: number }) {
  const router = useRouter();
  const { data: user, loading, refetch } = useFetch<ApiUser>(`/api/users/admin/users/${userId}/`);
  const [virtualAccounts, setVirtualAccounts] = React.useState<ApiVirtualAccount[]>([]);
  const [vaLoading, setVaLoading] = React.useState(true);
  const [generatingAccount, setGeneratingAccount] = React.useState(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [walletOpen, setWalletOpen] = React.useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = React.useState(false);
  const [resetPinOpen, setResetPinOpen] = React.useState(false);
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [clearLoginsOpen, setClearLoginsOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const fetchVirtualAccounts = React.useCallback(async () => {
    setVaLoading(true);
    try {
      const token = getClientToken();
      if (!token) return;
      const accounts = await adminApi.userVirtualAccounts(token, userId);
      setVirtualAccounts(Array.isArray(accounts) ? accounts : []);
    } catch {
      // silently fail
    } finally {
      setVaLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    fetchVirtualAccounts();
  }, [fetchVirtualAccounts]);

  const handleGenerateAccount = async () => {
    setGeneratingAccount(true);
    try {
      const token = getClientToken();
      if (!token) throw new Error("Not authenticated");
      await adminApi.createUserVirtualAccount(token, userId, "PAYVESSEL");
      toast.success("Virtual account generated");
      fetchVirtualAccounts();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to generate account";
      toast.error(msg);
    } finally {
      setGeneratingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="User not found"
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/admin/users">
                <ArrowLeft className="h-4 w-4" />
                Back to users
              </Link>
            </Button>
          }
        />
        <Card className="p-8 text-center text-muted-foreground">
          The requested user could not be found.
        </Card>
      </div>
    );
  }

  const initials = (user.name || user.username || "U")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const activeVa = virtualAccounts.filter((va) => va.is_active);
  const inactiveVa = virtualAccounts.filter((va) => !va.is_active);

  const handleAccessToggle = async (field: "has_atm_access" | "has_web_access" | "has_app_access", value: boolean) => {
    try {
      const token = getClientToken();
      if (!token) throw new Error("Not authenticated");
      await adminApi.updateUserLimits(token, userId, { [field]: value });
      refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update access";
      toast.error(msg);
    }
  };

  const handleSuspend = async () => {
    try {
      const token = getClientToken();
      if (!token) throw new Error("Not authenticated");
      await adminApi.suspendUser(token, userId);
      toast.success("User suspended");
      setSuspendOpen(false);
      refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to suspend user";
      toast.error(msg);
    }
  };

  const handleClearLogins = async () => {
    try {
      const token = getClientToken();
      if (!token) throw new Error("Not authenticated");
      await adminApi.clearLogins(token, userId);
      toast.success("All sessions cleared");
      setClearLoginsOpen(false);
      refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to clear logins";
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    try {
      const token = getClientToken();
      if (!token) throw new Error("Not authenticated");
      await adminApi.deleteUser(token, userId);
      toast.success("User deleted");
      setDeleteOpen(false);
      router.push("/dashboard/admin/users");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete user";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href="/dashboard/admin/users">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">{user.name || user.username}</h1>
          <p className="text-sm text-muted-foreground">User profile & management</p>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-br from-[var(--color-action)] to-[var(--color-accent)]" />
        <div className="px-6 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end -mt-10">
            <Avatar className="h-20 w-20 border-4 border-card shadow-lg">
              <AvatarFallback className="text-xl font-bold bg-[var(--color-action-subtle)] text-[var(--color-action)]">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pt-2 sm:pt-0 sm:pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{user.name || user.username}</h2>
                <Badge variant={user.role === "ADMIN" ? "teal" : "outline"}>
                  {user.role === "ADMIN" ? "Admin" : "User"}
                </Badge>
                <Badge variant={user.status === "active" || !user.status ? "success" : "warning"}>
                  {user.status || "Active"}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {user.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {user.email}
                  </span>
                )}
                {user.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {user.phone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Joined {formatDate(user.date_joined)}
                </span>
                {user.last_login && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Last login {formatDateTime(user.last_login)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/12 text-success">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="text-xl font-bold text-foreground">{formatNaira(Number(user.balance))}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-action-subtle)] text-[var(--color-action)]">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Airtime limit</p>
              <p className="text-xl font-bold text-foreground">{formatNaira(Number(user.airtime_limit))}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payment gateway limit</p>
              <p className="text-xl font-bold text-foreground">{formatNaira(Number(user.payment_gateway_limit))}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Virtual Accounts */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-action-subtle)] text-[var(--color-action)]">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Virtual Accounts</h3>
              <p className="text-xs text-muted-foreground">Bank accounts for wallet funding</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-md border bg-muted px-3 py-2 text-xs font-medium sm:inline-flex">PayVessel</span>
            <Button
              size="sm"
              loading={generatingAccount}
              onClick={handleGenerateAccount}
            >
              <Plus className="h-4 w-4" />
              Generate account
            </Button>
          </div>
        </div>

        {vaLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : virtualAccounts.length === 0 ? (
          <div className="py-8 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No virtual accounts yet</p>
            <p className="text-xs text-muted-foreground mt-1">Click &ldquo;Generate account&rdquo; to create one</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeVa.map((va) => (
              <VirtualAccountCard key={va.id} account={va} />
            ))}
            {inactiveVa.length > 0 && (
              <>
                {activeVa.length > 0 && (
                  <p className="text-xs text-muted-foreground pt-2">Inactive accounts</p>
                )}
                {inactiveVa.map((va) => (
                  <VirtualAccountCard key={va.id} account={va} />
                ))}
              </>
            )}
          </div>
        )}
      </Card>

      {/* Access Control */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Access Control</h3>
            <p className="text-xs text-muted-foreground">Manage platform access permissions</p>
          </div>
        </div>
        <div className="space-y-1">
          {[
            { field: "has_atm_access" as const, label: "ATM access", desc: "Allow ATM card transactions" },
            { field: "has_web_access" as const, label: "Web access", desc: "Allow web platform access" },
            { field: "has_app_access" as const, label: "App access", desc: "Allow mobile app access" },
          ].map((item) => (
            <div key={item.field} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={user[item.field]}
                onCheckedChange={(v) => handleAccessToggle(item.field, v)}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Actions */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <UserCog className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Actions</h3>
            <p className="text-xs text-muted-foreground">Manage this user account</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit user
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWalletOpen(true)}>
            <Wallet className="h-4 w-4" />
            Adjust wallet
          </Button>
          <Button variant="outline" size="sm" onClick={() => setResetPasswordOpen(true)}>
            <KeyRound className="h-4 w-4" />
            Reset password
          </Button>
          <Button variant="outline" size="sm" onClick={() => setResetPinOpen(true)}>
            <KeyRound className="h-4 w-4" />
            Reset PIN
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSuspendOpen(true)}>
            <Ban className="h-4 w-4" />
            {user.status === "inactive" ? "Unsuspend" : "Suspend"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setClearLoginsOpen(true)}>
            <LogOut className="h-4 w-4" />
            Clear logins
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Delete user
          </Button>
        </div>
      </Card>

      {/* Dialogs */}
      <EditUserDialog open={editOpen} onOpenChange={setEditOpen} user={user} onSuccess={refetch} />
      <WalletTransactionDialog open={walletOpen} onOpenChange={setWalletOpen} userId={userId} onSuccess={refetch} />
      <ResetPasswordDialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen} userId={userId} />
      <ResetPinDialog open={resetPinOpen} onOpenChange={setResetPinOpen} userId={userId} />
      <SuspendConfirmationDialog open={suspendOpen} onOpenChange={setSuspendOpen} onConfirm={handleSuspend} userName={user.name || user.username} />
      <ClearLoginsConfirmationDialog open={clearLoginsOpen} onOpenChange={setClearLoginsOpen} onConfirm={handleClearLogins} userName={user.name || user.username} />
      <DeleteConfirmationDialog open={deleteOpen} onOpenChange={setDeleteOpen} onConfirm={handleDelete} userName={user.name || user.username} />
    </div>
  );
}

// ── Virtual Account Card ──────────────────────────────────────

function VirtualAccountCard({ account }: { account: ApiVirtualAccount }) {
  const [copied, setCopied] = React.useState(false);

  const copyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText(account.account_number);
      setCopied(true);
      toast.success("Account number copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-card hover:bg-accent/5 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-action-subtle)] text-[var(--color-action)] shrink-0">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm font-semibold text-foreground tracking-wide">{account.account_number}</p>
            <Badge variant={account.is_active ? "success" : "outline"} className="text-[10px]">
              {account.is_active ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              PayVessel
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{account.bank_name} &middot; {account.account_name}</p>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={copyAccountNumber}>
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// ── Edit User Dialog ──────────────────────────────────────────

function EditUserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: ApiUser;
  onSuccess: () => void;
}) {
  const [firstName, setFirstName] = React.useState(user.first_name);
  const [lastName, setLastName] = React.useState(user.last_name);
  const [email, setEmail] = React.useState(user.email);
  const [phone, setPhone] = React.useState(user.phone);
  const [role, setRole] = React.useState<string>(user.role);
  const [isActive, setIsActive] = React.useState(user.status === "active" || !user.status);
  const [saving, setSaving] = React.useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setFirstName(user.first_name);
      setLastName(user.last_name);
      setEmail(user.email);
      setPhone(user.phone);
      setRole(user.role);
      setIsActive(user.status === "active" || !user.status);
    }
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getClientToken();
      if (!token) throw new Error("Not authenticated");
      await adminApi.updateUser(token, user.id, {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        role,
        is_active: isActive,
      });
      toast.success("User updated");
      onOpenChange(false);
      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update user";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update profile information and role.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">User can log in when active</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="accent" size="sm" loading={saving} onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Wallet Transaction Dialog ─────────────────────────────────

function WalletTransactionDialog({
  open,
  onOpenChange,
  userId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: number;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = React.useState("");
  const [action, setAction] = React.useState<"credit" | "debit">("credit");
  const [description, setDescription] = React.useState("");
  const [source, setSource] = React.useState<"WALLET" | "CASHBACK">("WALLET");
  const [saving, setSaving] = React.useState(false);
  // One key per dialog session: a double-click or retry replays the same request
  // instead of adjusting the wallet twice.
  const idempotencyKey = React.useRef<string>("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setAmount("");
      setAction("credit");
      setDescription("");
      setSource("WALLET");
      idempotencyKey.current = crypto.randomUUID();
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (description.trim().length < 3) {
      toast.error("Enter a reason for this adjustment");
      return;
    }
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    setSaving(true);
    try {
      const token = getClientToken();
      if (!token) throw new Error("Not authenticated");
      const res = await adminApi.walletTransaction(token, userId, {
        amount,
        type: action === "credit" ? "CREDIT" : "DEBIT",
        reason: description.trim(),
        source,
        idempotency_key: idempotencyKey.current,
      });
      if (res.status === "PENDING_APPROVAL") {
        toast.success("Submitted. Another admin must approve this adjustment.");
      } else {
        toast.success(`Wallet ${action === "credit" ? "credited" : "debited"} successfully`);
      }
      onOpenChange(false);
      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust wallet</DialogTitle>
          <DialogDescription>Credit or debit the user&apos;s wallet balance.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as "credit" | "debit")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit">Credit (add funds)</SelectItem>
                <SelectItem value="debit">Debit (remove funds)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Balance</Label>
            <Select value={source} onValueChange={(v) => setSource(v as "WALLET" | "CASHBACK")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WALLET">Wallet</SelectItem>
                <SelectItem value="CASHBACK">Cashback</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount (NGN)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reason (required)</Label>
            <Input
              placeholder="e.g. Wallet adjustment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={action === "credit" ? "teal" : "destructive"}
            size="sm"
            loading={saving}
            onClick={handleSubmit}
          >
            <CreditCard className="h-4 w-4" />
            {action === "credit" ? "Credit" : "Debit"} wallet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Reset Password Dialog ─────────────────────────────────────

function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: number;
}) {
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setPassword("");
    onOpenChange(nextOpen);
  };

  const handleReset = async () => {
    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      const token = getClientToken();
      if (!token) throw new Error("Not authenticated");
      const result = await adminApi.resetUserPassword(token, userId, password);
      toast.success("Password reset successfully");
      if ((result as Record<string, unknown>).new_password) {
        toast.info(`New password: ${(result as Record<string, unknown>).new_password}`);
      }
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to reset password";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a new password for this user.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>New password</Label>
          <PasswordInput
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="accent" size="sm" loading={saving} onClick={handleReset}>
            <KeyRound className="h-4 w-4" />
            Reset password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Reset PIN Dialog ──────────────────────────────────────────

function ResetPinDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: number;
}) {
  const [pin, setPin] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setPin("");
    onOpenChange(nextOpen);
  };

  const handleReset = async () => {
    if (!pin || pin.length < 4) {
      toast.error("PIN must be at least 4 digits");
      return;
    }
    setSaving(true);
    try {
      const token = getClientToken();
      if (!token) throw new Error("Not authenticated");
      await adminApi.resetUserPin(token, userId, pin);
      toast.success("PIN reset successfully");
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to reset PIN";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset PIN</DialogTitle>
          <DialogDescription>Set a new transaction PIN for this user.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>New PIN</Label>
          <Input
            type="password"
            placeholder="4-6 digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="accent" size="sm" loading={saving} onClick={handleReset}>
            <KeyRound className="h-4 w-4" />
            Reset PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Confirmation Dialogs ──────────────────────────────────────

function SuspendConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  userName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  userName: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend user</DialogTitle>
          <DialogDescription>
            Are you sure you want to suspend <strong>{userName}</strong>? They will not be able to
            log in until their account is reactivated.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            <Ban className="h-4 w-4" />
            Suspend user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClearLoginsConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  userName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  userName: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear logins</DialogTitle>
          <DialogDescription>
            This will sign <strong>{userName}</strong> out of all active sessions. They will need to
            log in again on all devices.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="accent" size="sm" onClick={onConfirm}>
            <LogOut className="h-4 w-4" />
            Clear all sessions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  userName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  userName: string;
}) {
  const [confirmName, setConfirmName] = React.useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setConfirmName("");
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            This action is irreversible. All data associated with <strong>{userName}</strong> will
            be permanently deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Type the username to confirm</Label>
          <Input
            placeholder={userName}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={confirmName !== userName}
            onClick={onConfirm}
          >
            <Trash2 className="h-4 w-4" />
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
