"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { registerAction } from "../login/actions";

function stripCountryCode(value: string): string {
  let v = value.replace(/\D/g, "");
  if (v.startsWith("234") && v.length > 11) v = v.slice(3);
  if (v.startsWith("0") && v.length > 11) v = v.slice(0, 11);
  if (!v.startsWith("0") && v.length === 10) v = "0" + v;
  return v.slice(0, 11);
}

const schema = z
  .object({
    username: z.string().min(3, "Username must be at least 3 characters").max(150),
    phone: z
      .string()
      .regex(/^0\d{10}$/, "Enter a valid 11-digit phone number (e.g. 08012345678)"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setValue,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    const result = await registerAction(data.username, data.phone, data.password, data.email, data.confirm);
    if (result?.error) {
      setError("root", { message: result.error });
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">Create your account</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Start paying bills the easy way. It only takes a minute.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errors.root && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 whitespace-pre-wrap">
            {errors.root.message}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="username" className="text-sm font-medium text-[var(--foreground)]">Username</Label>
          <Input
            id="username"
            placeholder="Choose a username"
            autoComplete="username"
            {...register("username")}
            aria-invalid={!!errors.username}
            className="h-12 rounded-xl border-[var(--color-border)] bg-[var(--color-surface-elevated)] focus:border-[var(--foreground)] focus:ring-[var(--foreground)]/10"
          />
          {errors.username && <p className="text-xs text-red-600">{errors.username.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium text-[var(--foreground)]">Phone number</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="08012345678"
            autoComplete="tel"
            {...register("phone", {
              onChange: (e) => {
                setValue("phone", stripCountryCode(e.target.value), { shouldValidate: false });
              },
            })}
            aria-invalid={!!errors.phone}
            className="h-12 rounded-xl border-[var(--color-border)] bg-[var(--color-surface-elevated)] focus:border-[var(--foreground)] focus:ring-[var(--foreground)]/10"
          />
          {errors.phone ? (
            <p className="text-xs text-red-600">{errors.phone.message}</p>
          ) : (
            <p className="text-xs text-[var(--color-text-secondary)]">11 digits, no country code</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-[var(--foreground)]">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            {...register("email")}
            aria-invalid={!!errors.email}
            className="h-12 rounded-xl border-[var(--color-border)] bg-[var(--color-surface-elevated)] focus:border-[var(--foreground)] focus:ring-[var(--foreground)]/10"
          />
          {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-[var(--foreground)]">Password</Label>
            <PasswordInput
              id="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register("password")}
              aria-invalid={!!errors.password}
              className="h-12 rounded-xl border-[var(--color-border)] bg-[var(--color-surface-elevated)] focus:border-[var(--foreground)] focus:ring-[var(--foreground)]/10"
            />
            {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-sm font-medium text-[var(--foreground)]">Confirm</Label>
            <PasswordInput
              id="confirm"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register("confirm")}
              aria-invalid={!!errors.confirm}
              className="h-12 rounded-xl border-[var(--color-border)] bg-[var(--color-surface-elevated)] focus:border-[var(--foreground)] focus:ring-[var(--foreground)]/10"
            />
            {errors.confirm && <p className="text-xs text-red-600">{errors.confirm.message}</p>}
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          loading={isSubmitting}
          className="w-full h-12 rounded-xl bg-[var(--color-surface-dark)] text-white hover:bg-[var(--color-surface-dark)]/90 font-semibold"
        >
          Create account
        </Button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--foreground)] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
