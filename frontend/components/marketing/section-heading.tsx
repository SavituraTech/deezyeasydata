import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className
      )}
    >
      {eyebrow && (
        <span className="text-sm font-semibold uppercase tracking-wide text-[var(--color-action)]">{eyebrow}</span>
      )}
      <h2 className="mt-2 text-[var(--font-h2)] font-bold tracking-tight text-[var(--foreground)] sm:text-[var(--font-h1)]">{title}</h2>
      {description && <p className="mt-4 text-lg text-[var(--color-text-secondary)]">{description}</p>}
    </div>
  );
}
