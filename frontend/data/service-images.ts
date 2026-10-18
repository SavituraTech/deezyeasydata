/**
 * Service provider image mapping.
 *
 * Maps network names, cable providers, electricity providers,
 * broadband providers, and education providers to their logo paths.
 *
 * All logos are vendored into `public/logos/` (downloaded from
 * newdatasub.com and public CDNs) so they are served same-origin
 * by Next.js — cached and never dependent on third-party uptime.
 */

// ── Network Logos ───────────────────────────────────────────────
export const NETWORK_LOGOS: Record<string, string> = {
  MTN: "/logos/mtn.png",
  GLO: "/logos/glo.png",
  AIRTEL: "/logos/airtel.png",
  "9MOBILE": "/logos/9mobile.jpg",
};

// ── Cable TV Provider Logos ────────────────────────────────────
export const CABLE_LOGOS: Record<string, string> = {
  GOTV: "/logos/gotv.jpg",
  STARTIMES: "/logos/startimes.png",
  DSTV: "/logos/dstv.png",
};

// ── Electricity Provider Logos ─────────────────────────────────
export const ELECTRICITY_LOGOS: Record<string, string> = {
  IKEDC: "/logos/ikedc.png",
  IBEDC: "/logos/ibedc.png",
  AEDC: "/logos/aedc.png",
  KEDC: "/logos/kedc.png",
  YEDC: "/logos/yedc.png",
  KNEDC: "/logos/knedc.jpg",
  PHED: "/logos/phed.png",
  EKEDC: "/logos/ekedc.jpg",
  BEDC: "/logos/bedc.png",
  EEDC: "/logos/eedc.png",
  JEDC: "/logos/jedc.png",
};

// ── Broadband Provider Logos ──────────────────────────────────
export const BROADBAND_LOGOS: Record<string, string> = {
  SMILE: "/logos/smile.png",
  SPECTRANET: "/logos/spectranet.png",
};

// ── Education Provider Logos ──────────────────────────────────
export const EDUCATION_LOGOS: Record<string, string> = {
  JAMB: "/logos/jamb.png",
  WAEC: "/logos/waec.png",
  NECO: "/logos/neco.jpg",
};

// ── Unified lookup ─────────────────────────────────────────────
const ALL_LOGOS: Record<string, string> = {
  ...NETWORK_LOGOS,
  ...CABLE_LOGOS,
  ...ELECTRICITY_LOGOS,
  ...BROADBAND_LOGOS,
  ...EDUCATION_LOGOS,
};

/**
 * Get the logo URL for a product, using:
 * 1. The product's own image_url if available
 * 2. The network logo if it has a network
 * 3. The provider logo from the static map
 * 4. null if nothing matches
 */
export function getProductLogo(product: {
  image_url?: string | null;
  network?: string | null;
  provider?: string;
}): string | null {
  if (product.image_url) return product.image_url;
  if (product.network && ALL_LOGOS[product.network]) {
    return ALL_LOGOS[product.network];
  }
  if (product.provider && ALL_LOGOS[product.provider]) {
    return ALL_LOGOS[product.provider];
  }
  return null;
}
