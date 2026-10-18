import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h2 className="text-2xl font-bold text-foreground">Page not found</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Button variant="accent" className="mt-6" asChild>
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  );
}
