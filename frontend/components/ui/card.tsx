import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-[var(--radius-lg)] bg-[var(--color-surface)] text-[var(--card-foreground)] transition-shadow duration-[var(--duration-base)]",
  {
    variants: {
      variant: {
        standard: "shadow-[var(--shadow-md)]",
        elevated: "shadow-[var(--shadow-xl)] rounded-[var(--radius-xl)]",
        bordered: "border border-[var(--color-border)]",
        wallet: "bg-[var(--color-primary)] text-[var(--color-text-inverse)] shadow-[var(--shadow-xl)] rounded-[var(--radius-xl)]",
        "service-tile": "shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] hover:border hover:border-[var(--color-accent)] cursor-pointer",
      },
    },
    defaultVariants: {
      variant: "standard",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />;
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-lg font-semibold leading-tight tracking-tight", className)} {...props} />
  );
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-[var(--color-text-secondary)]", className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };
