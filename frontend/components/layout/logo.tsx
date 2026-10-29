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
      <Image
        src="/deezy-wordmark.png"
        alt="Deezy Easy Data"
        width={565}
        height={210}
        className={cn("h-auto w-[178px] rounded-lg", !showText && "w-[164px]")}
        priority
      />
    </Link>
  );
}
