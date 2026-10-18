import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
  showText = true,
}: {
  className?: string;
  href?: string;
  showText?: boolean;
  variant?: "logo" | "tag";
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center", className)} aria-label="Deezy Easy Data home">
      <span className={cn("relative block h-[52px] w-[178px] overflow-hidden rounded-lg bg-white outline outline-1 -outline-offset-1 outline-black/10", !showText && "h-12 w-[164px]")}>
        <Image
          src="/deezy-logo.png"
          alt="Deezy Easy Data"
          width={342}
          height={187}
          className="pointer-events-none absolute -left-[76px] -top-[61px] max-w-none select-none"
          priority
        />
      </span>
    </Link>
  );
}
