import type { Metadata } from "next";
import { ProductsView } from "@/components/dashboard/admin/products-view";

export const metadata: Metadata = { title: "Products" };

export default function AdminProductsPage() {
  return <ProductsView />;
}
