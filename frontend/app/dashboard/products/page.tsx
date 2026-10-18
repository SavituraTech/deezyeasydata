import type { Metadata } from "next";
import { ProductCatalogView } from "@/components/dashboard/product-catalog-view";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return <ProductCatalogView />;
}
