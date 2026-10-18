"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApi, getClientToken } from "@/lib/api";

function stripCountryCode(value: string): string {
  let v = value.replace(/\D/g, "");
  if (v.startsWith("234") && v.length > 11) v = v.slice(3);
  if (v.startsWith("0") && v.length > 11) v = v.slice(0, 11);
  if (!v.startsWith("0") && v.length === 10) v = "0" + v;
  return v.slice(0, 11);
}

const schema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  phone: z.string().regex(/^0\d{10}$/, "Enter a valid 11-digit phone number (e.g. 08012345678)"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["USER", "ADMIN"]),
});

type FormValues = z.infer<typeof schema>;

export function CreateUserView() {
  const router = useRouter();
  const [role, setRole] = React.useState<"USER" | "ADMIN">("USER");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: "USER" },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const token = getClientToken();
      if (!token) throw new Error("Not authenticated");
      await adminApi.createUser(token, {
        username: data.username,
        phone: data.phone,
        email: data.email || undefined,
        password: data.password,
        role: data.role,
      });
      toast.success("User created successfully");
      router.push("/dashboard/admin/users");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create user";
      setError("root", { message: msg });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create user"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/admin/users">
              <ArrowLeft className="h-4 w-4" />
              Back to users
            </Link>
          </Button>
        }
      />

      <Card className="max-w-lg p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {errors.root && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errors.root.message}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="e.g. johndoe"
              {...register("username")}
              aria-invalid={!!errors.username}
            />
            {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="e.g. 08012345678"
              {...register("phone", {
                onChange: (e) => {
                  setValue("phone", stripCountryCode(e.target.value), { shouldValidate: false });
                },
              })}
              aria-invalid={!!errors.phone}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            {!errors.phone && <p className="text-xs text-muted-foreground">11 digits, no country code</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="e.g. john@example.com"
              {...register("email")}
              aria-invalid={!!errors.email}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              placeholder="Minimum 8 characters"
              {...register("password")}
              aria-invalid={!!errors.password}
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => { setRole(v as "USER" | "ADMIN"); setValue("role", v as "USER" | "ADMIN"); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" variant="accent" size="lg" loading={isSubmitting} className="w-full">
            Create user
          </Button>
        </form>
      </Card>
    </div>
  );
}
