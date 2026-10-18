"use client";

import * as React from "react";
import { getProductLogo } from "@/data/service-images";

/**
 * Product image with a graceful fallback chain:
 *   1. `image_url` (from the API)
 *   2. network / provider logo from `service-images.ts` (vendored `/logos/*`)
 *   3. renders nothing — caller shows its own fallback icon
 *
 * Each step advances on <img> error, so a stale or broken image_url
 * (e.g. an old external URL still stored in the DB) never leaves an
 * empty box: the correct vendored logo is shown instead.
 */
export function ProductLogo({
  product,
  alt,
  className,
}: {
  product: {
    image_url?: string | null;
    network?: string | null;
    provider?: string | null;
  };
  alt: string;
  className?: string;
}) {
  const primary = product.image_url || null;
  const secondary = getProductLogo({
    network: product.network ?? undefined,
    provider: product.provider ?? undefined,
  });

  const [stage, setStage] = React.useState(0);
  React.useEffect(() => {
    setStage(0);
  }, [primary, secondary]);

  const src = stage === 0 ? primary : stage === 1 ? secondary : null;
  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setStage((s) => s + 1)}
    />
  );
}
