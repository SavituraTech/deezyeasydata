import type { ApiProduct } from "@/lib/api";

export type DataPlanCategory = "CORPORATE" | "SME" | "GIFTING" | "AWOOF" | "ALL";

export const DATA_CATEGORY_ORDER: DataPlanCategory[] = [
  "CORPORATE",
  "SME",
  "GIFTING",
  "AWOOF",
  "ALL",
];

/**
 * Normalize a provider-supplied plan group (e.g. "SME", "CORPORATE GIFTING",
 * "GIFTING DATA", "DATA_AWOOF") into one of the UI tab categories.
 * Returns null when the value does not map to a known tab.
 */
function normalizePlanGroup(value: string | null | undefined): DataPlanCategory | null {
  if (!value) return null;
  const v = value.toUpperCase();
  if (v.includes("CORPORATE")) return "CORPORATE";
  if (v.includes("SME")) return "SME";
  if (v.includes("GIFT")) return "GIFTING";
  if (v.includes("AWOOF")) return "AWOOF";
  return null;
}

/**
 * Determine the sub-category of a data product based on its name and provider code.
 * Name/code heuristics take priority over `plan_group` to ensure CORPORATE
 * products are not misclassified when the sync populates plan_group with a
 * different value (e.g. "SME" for MTN corporate gifting plans).
 */
export function getDataPlanCategory(product: ApiProduct): DataPlanCategory {
  const name = product.name.toUpperCase();
  const code = (product.provider_product_code || "").toUpperCase();

  if (name.includes("SME")) return "SME";
  if (name.includes("CG") || name.includes("CORPORATE") || code.includes("CG")) return "CORPORATE";
  if (name.includes("GIFTING")) return "GIFTING";
  if (name.includes("AWOOF")) return "AWOOF";

  const fromServer = normalizePlanGroup(product.plan_group);
  if (fromServer) return fromServer;

  return "ALL";
}

/**
 * Group data products by their determined category.
 */
export function groupDataPlansByCategory(products: ApiProduct[]): Record<DataPlanCategory, ApiProduct[]> {
  const grouped: Record<DataPlanCategory, ApiProduct[]> = {
    CORPORATE: [],
    SME: [],
    GIFTING: [],
    AWOOF: [],
    ALL: [],
  };

  for (const product of products) {
    const category = getDataPlanCategory(product);
    grouped[category].push(product);
  }

  return grouped;
}

/**
 * Get available categories from a grouped set, in predefined order.
 */
export function getAvailableDataCategories(grouped: Record<DataPlanCategory, ApiProduct[]>): DataPlanCategory[] {
  return DATA_CATEGORY_ORDER.filter((cat) => grouped[cat].length > 0);
}
