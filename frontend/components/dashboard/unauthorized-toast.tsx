"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export function UnauthorizedToast() {
  return (
    <Suspense fallback={null}>
      <UnauthorizedToastInner />
    </Suspense>
  );
}

function UnauthorizedToastInner() {
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("denied")) {
      toast.error("You don't have permission to access that page.");
    }
  }, [params]);

  return null;
}
