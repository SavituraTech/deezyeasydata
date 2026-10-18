"use client";

import * as React from "react";
import { BadgeCheck, Calendar, Lock, Mail, Phone, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/components/dashboard/role-context";
import { useFetch } from "@/hooks/use-api";
import { authApi, getClientToken } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { ApiUser } from "@/lib/api";

export function ProfileView() {
  const { user: ctxUser } = useRole();
  const { data: user, loading, refetch } = useFetch<ApiUser>("/api/users/me/");

  const u = user || ctxUser;
  const initials = (u.name || u.username || "U")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const formRef = React.useRef<HTMLFormElement>(null);
  const [saving, setSaving] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [showPasswordForm, setShowPasswordForm] = React.useState(false);
  const [passwordSaving, setPasswordSaving] = React.useState(false);
  const passwordFormRef = React.useRef<HTMLFormElement>(null);
  const [profileSuccess, setProfileSuccess] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);

  // Warn before leaving with unsaved changes
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleFormChange = () => {
    if (!isDirty) setIsDirty(true);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;

    const formData = new FormData(form);
    const name = (formData.get("name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim();
    const id_type = formData.get("id_type") as "bvn" | "nin";
    const id_number = (formData.get("id_number") as string)?.trim();

    if (phone && !/^0[789][01]\d{8}$/.test(phone)) {
      setFieldErrors({ phone: "Invalid Nigerian phone (e.g. 08012345678)" });
      toast.error("Please fix phone number");
      return;
    }
    if (!/^\d{11}$/.test(id_number)) {
      setFieldErrors({ id_number: "BVN or NIN must be exactly 11 digits" });
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      const token = getClientToken();
      if (!token) throw new Error("Not authenticated");
      await authApi.updateProfile(token, { name: name || undefined, email: email || undefined, phone: phone || undefined, id_type, id_number });
      toast.success("Profile updated");
      setProfileSuccess(true);
      setIsDirty(false);
      setTimeout(() => setProfileSuccess(false), 1500);
      refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      const data = (err as unknown as { data?: unknown })?.data;
      if (data && typeof data === "object" && "phone" in (data as Record<string, unknown>)) {
        const phoneErr = (data as Record<string, unknown>).phone;
        const text = Array.isArray(phoneErr) ? String(phoneErr[0]) : String(phoneErr);
        setFieldErrors({ phone: text });
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = passwordFormRef.current;
    if (!form) return;

    const formData = new FormData(form);
    const oldPassword = formData.get("old_password") as string;
    const newPassword = formData.get("new_password") as string;
    const confirmPassword = formData.get("confirm_password") as string;

    if (!oldPassword || !newPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setPasswordSaving(true);
    try {
      const token = getClientToken();
      if (!token) throw new Error("Not authenticated");
      await authApi.changePassword(token, { old_password: oldPassword, new_password: newPassword });
      toast.success("Password changed successfully");
      form.reset();
      setShowPasswordForm(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to change password";
      toast.error(msg);
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Profile" description="Manage your account and preferences." />
        <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Manage your account and preferences." />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card className="p-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-gradient text-2xl font-bold text-white">
            {initials}
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">{u.name || u.username}</h2>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <BadgeCheck className="h-4 w-4 text-[var(--color-action)]" />
            {u.role === "ADMIN" ? "Admin" : "User"} account
          </div>

          <dl className="mt-6 space-y-3 text-left text-sm">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="truncate text-foreground">{u.email || "—"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{u.phone || "—"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">Joined {formatDate(u.date_joined)}</span>
            </div>
          </dl>
        </Card>

        <div className="space-y-6">
          <motion.div
            animate={profileSuccess ? {
              boxShadow: ["0 0 0 0 rgba(60, 176, 67, 0)", "0 0 0 8px rgba(60, 176, 67, 0.15)", "0 0 0 0 rgba(60, 176, 67, 0)"],
            } : {}}
            transition={{ duration: 1.5, ease: "easeOut" }}
          >
            <Card className="p-6">
              <h3 className="font-semibold text-foreground">Personal information</h3>
              <p className="text-xs text-muted-foreground mt-1">Update your name, email and phone number.</p>
              <form ref={formRef} onSubmit={onSave} onChange={handleFormChange} className="mt-4 space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" name="name" defaultValue={u.name || `${u.first_name} ${u.last_name}`.trim()} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" defaultValue={u.email ?? ""} aria-describedby={fieldErrors.email ? "email-error" : undefined} aria-invalid={!!fieldErrors.email} />
                    {fieldErrors.email && <p id="email-error" className="text-xs text-destructive" role="alert">{fieldErrors.email}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      defaultValue={u.phone}
                      placeholder="08012345678"
                      aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                      aria-invalid={!!fieldErrors.phone}
                      className={fieldErrors.phone ? "border-destructive" : undefined}
                    />
                    {fieldErrors.phone && <p id="phone-error" className="text-xs text-destructive" role="alert">{fieldErrors.phone}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="id_type">Identity type</Label>
                    <select id="id_type" name="id_type" defaultValue={u.id_type || "bvn"} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="bvn">BVN</option><option value="nin">NIN</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="id_number">11-digit BVN/NIN</Label>
                    <Input id="id_number" name="id_number" type="password" inputMode="numeric" maxLength={11} defaultValue={u.id_number || ""} />
                    {fieldErrors.id_number && <p className="text-xs text-destructive">{fieldErrors.id_number}</p>}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="accent" loading={saving}>
                    Save changes
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Security</h3>
                <p className="text-xs text-muted-foreground mt-1">Manage your password and account security.</p>
              </div>
              <Shield className="h-5 w-5 text-muted-foreground" />
            </div>

            {!showPasswordForm ? (
              <Button
                variant="outline"
                className="mt-4 gap-2"
                onClick={() => setShowPasswordForm(true)}
              >
                <Lock className="h-4 w-4" />
                Change password
              </Button>
            ) : (
              <form ref={passwordFormRef} onSubmit={onChangePassword} className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="old_password">Current password</Label>
                  <Input id="old_password" name="old_password" type="password" autoComplete="current-password" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new_password">New password</Label>
                  <Input id="new_password" name="new_password" type="password" autoComplete="new-password" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm_password">Confirm new password</Label>
                  <Input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setShowPasswordForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="accent" loading={passwordSaving}>
                    Update password
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
