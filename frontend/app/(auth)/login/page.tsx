"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { loginAction } from "./actions";

const schema = z.object({
  username: z.string().min(1, "Enter your username"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    const result = await loginAction(data.username, data.password);
    if (result?.error) {
      setError("root", { message: result.error });
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">Welcome back</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Log in to your Deezy Easy Data account to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {errors.root && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            {errors.root.message}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="username" className="text-sm font-medium text-[var(--foreground)]">Username</Label>
          <Input
            id="username"
            placeholder="Enter your username"
            autoComplete="username"
            {...register("username")}
            aria-invalid={!!errors.username}
            className="h-12 rounded-xl border-[var(--color-border)] bg-[var(--color-surface-elevated)] focus:border-[var(--foreground)] focus:ring-[var(--foreground)]/10"
          />
          {errors.username && <p className="text-xs text-red-600">{errors.username.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-[var(--foreground)]">Password</Label>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            autoComplete="current-password"
            {...register("password")}
            aria-invalid={!!errors.password}
            className="h-12 rounded-xl border-[var(--color-border)] bg-[var(--color-surface-elevated)] focus:border-[var(--foreground)] focus:ring-[var(--foreground)]/10"
          />
          {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <Button
          type="submit"
          size="lg"
          loading={isSubmitting}
          className="w-full h-12 rounded-xl bg-[var(--color-surface-dark)] text-white hover:bg-[var(--color-surface-dark)]/90 font-semibold"
        >
          Log in
        </Button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-semibold text-[var(--foreground)] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
