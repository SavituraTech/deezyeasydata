"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h2 className="text-2xl font-bold text-foreground">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        An unexpected error occurred. Please try again.
      </p>
      <Button variant="accent" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
