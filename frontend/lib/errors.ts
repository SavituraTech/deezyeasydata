const FRIENDLY_ERRORS: Record<string, string> = {
  INSUFFICIENT_FUNDS: "Insufficient balance. Please fund your wallet.",
  PROVIDER_FAILED: "Service temporarily unavailable. Please try again later.",
  PROVIDER_TIMEOUT: "Request timed out. Please try again.",
  INTERNAL_SERVER_ERROR: "Something went wrong. Please try again.",
  PRODUCT_NOT_FOUND: "Product not found. Please try again.",
  NETWORK_ERROR: "Network error. Please check your connection and try again.",
};

export function friendlyError(raw: string | undefined | null): string {
  if (!raw) return "Something went wrong. Please try again or contact support.";

  const upper = raw.toUpperCase();

  for (const [code, msg] of Object.entries(FRIENDLY_ERRORS)) {
    if (upper.includes(code)) return msg;
  }

  if (upper.includes("TIMEOUT") || upper.includes("TIMED OUT")) {
    return "Request timed out. Please try again.";
  }
  if (upper.includes("NETWORK") || upper.includes("CONNECTION")) {
    return "Network error. Please check your connection and try again.";
  }
  if (upper.includes("AUTH") || upper.includes("TOKEN") || upper.includes("SESSION")) {
    return "Session expired. Please log in again.";
  }

  return "Something went wrong. Please try again or contact support.";
}
