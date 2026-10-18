"use client";

import * as React from "react";
import {
  Search,
  Plus,
  Edit,
  Filter,
  X,
  Package,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { adminApi, getClientToken, type ApiProduct, type ProductCategory } from "@/lib/api";
import { getProductLogo } from "@/data/service-images";
import { ProductLogo } from "@/components/dashboard/product-logo";
import { formatNaira } from "@/lib/utils";

const CATEGORIES: ProductCategory[] = ["AIRTIME", "DATA", "SME_DATA", "ELECTRICITY", "CABLE", "BROADBAND", "EDUCATION", "STREAMING"];
const NETWORKS = ["MTN", "GLO", "AIRTEL", "9MOBILE"];

const CATEGORY_LABELS: Record<string, string> = {
  AIRTIME: "Airtime",
  DATA: "Data",
  SME_DATA: "SME Data",
  ELECTRICITY: "Electricity",
  CABLE: "Cable TV",
  BROADBAND: "Broadband",
  EDUCATION: "Education",
  STREAMING: "Streaming",
};

export function ProductsView() {
  const [products, setProducts] = React.useState<ApiProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const pageSize = 50;

  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [networkFilter, setNetworkFilter] = React.useState<string>("all");

  const [editProduct, setEditProduct] = React.useState<ApiProduct | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleteProduct, setDeleteProduct] = React.useState<ApiProduct | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const [form, setForm] = React.useState({
    name: "",
    category: "AIRTIME" as ProductCategory,
    network: "",
    provider: "",
    provider_product_code: "",
    cost_price: "",
    selling_price: "",
    commission: "0.00",
    description: "",
    is_active: true,
    cashback_enabled: true,
    cashback_rate_percent: "",
    data_size: "",
    data_validity: "",
  });

  const fetchProducts = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = getClientToken();
      if (!token) return;
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (search.trim()) params.search = search.trim();
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (networkFilter !== "all") params.network = networkFilter;
      const res = await adminApi.products(token, params as Parameters<typeof adminApi.products>[1]);
      setProducts(res?.results ?? []);
      setTotalCount(res?.count ?? 0);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, networkFilter]);

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const resetForm = () => {
    setForm({
      name: "",
      category: "AIRTIME",
      network: "",
      // Default to a non-sync provider so manually added products are never
      // overwritten or deactivated by the Newdatasub catalog sync.
      provider: "manual",
      provider_product_code: "",
      cost_price: "",
      selling_price: "",
      commission: "0.00",
      description: "",
      is_active: true,
      cashback_enabled: true,
      cashback_rate_percent: "",
      data_size: "",
      data_validity: "",
    });
  };

  const openEdit = (product: ApiProduct) => {
    setEditProduct(product);
    setForm({
      name: product.name,
      category: product.category,
      network: product.network || "",
      provider: product.provider,
      provider_product_code: product.provider_product_code,
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      commission: product.commission,
      description: product.description || "",
      is_active: product.is_active,
      cashback_enabled: product.cashback_enabled,
      cashback_rate_percent: product.cashback_rate_percent || "",
      data_size: product.data_size || "",
      data_validity: product.data_validity || "",
    });
    setEditOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const handleSave = async (isCreate: boolean) => {
    if (!form.name.trim() || !form.cost_price || !form.selling_price) {
      toast.error("Name, cost price and selling price are required");
      return;
    }
    setSaving(true);
    try {
      const token = getClientToken();
      if (!token) return;
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        category: form.category,
        network: form.network || null,
        provider: form.provider.trim(),
        provider_product_code: form.provider_product_code.trim(),
        cost_price: form.cost_price,
        selling_price: form.selling_price,
        commission: form.commission || "0.00",
        description: form.description.trim() || null,
        is_active: form.is_active,
        cashback_enabled: form.cashback_enabled,
        cashback_rate_percent: form.cashback_rate_percent || null,
        data_size: form.data_size || null,
        data_validity: form.data_validity || null,
      };
      if (isCreate) {
        await adminApi.createProduct(token, payload as Partial<ApiProduct>);
        toast.success("Product created");
        setCreateOpen(false);
      } else if (editProduct) {
        await adminApi.updateProduct(token, editProduct.id, payload as Partial<ApiProduct>);
        toast.success("Product updated");
        setEditOpen(false);
      }
      fetchProducts();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (product: ApiProduct) => {
    try {
      const token = getClientToken();
      if (!token) return;
      await adminApi.updateProduct(token, product.id, { is_active: !product.is_active });
      fetchProducts();
    } catch {
      toast.error("Failed to toggle status");
    }
  };

  const handleDelete = async () => {
    if (!deleteProduct) return;
    setDeleting(true);
    try {
      const token = getClientToken();
      if (!token) return;
      await adminApi.deleteProduct(token, deleteProduct.id);
      toast.success("Product removed");
      setDeleteProduct(null);
      fetchProducts();
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const showNetwork = categoryFilter === "all" || categoryFilter === "AIRTIME" || categoryFilter === "DATA" || categoryFilter === "SME_DATA";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchProducts(); }} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11"
          />
        </form>
        <div className="flex flex-wrap gap-2">
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <Filter className="h-3.5 w-3.5" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showNetwork && (
            <Select value={networkFilter} onValueChange={(v) => { setNetworkFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[130px]">
                <Filter className="h-3.5 w-3.5" />
                <SelectValue placeholder="Network" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All networks</SelectItem>
                {NETWORKS.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {(categoryFilter !== "all" || networkFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setCategoryFilter("all"); setNetworkFilter("all"); setPage(1); }}>
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        </div>
      </div>

      <Card className="p-5">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No products found.</p>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Network</th>
                  <th className="pb-3 text-right font-medium">Cost</th>
                  <th className="pb-3 text-right font-medium">Price</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        {p.image_url || getProductLogo(p) ? (
                          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-elevated)] overflow-hidden border border-border">
                            <ProductLogo
                              product={p}
                              alt={p.name}
                              className="h-full w-full object-contain p-0.5"
                            />
                          </span>
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-action-subtle)] text-[var(--color-action)]">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.provider_product_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{CATEGORY_LABELS[p.category] || p.category}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{p.network || "—"}</td>
                    <td className="py-3 pr-4 text-right text-muted-foreground">{formatNaira(Number(p.cost_price))}</td>
                    <td className="py-3 pr-4 text-right font-medium text-foreground">{formatNaira(Number(p.selling_price))}</td>
                    <td className="py-3 pr-4">
                      <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteProduct(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
      </Card>

      <Dialog open={editOpen || createOpen} onOpenChange={(open) => { if (!open) { setEditOpen(false); setCreateOpen(false); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{createOpen ? "Add product" : "Edit product"}</DialogTitle>
            <DialogDescription>
              {createOpen ? "Create a new product in the catalogue." : `Editing: ${editProduct?.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Category</label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as ProductCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Network</label>
              <Select value={form.network || "none"} onValueChange={(v) => setForm({ ...form, network: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {NETWORKS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Provider</label>
              <Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="e.g. manual" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Provider Code</label>
              <Input value={form.provider_product_code} onChange={(e) => setForm({ ...form, provider_product_code: e.target.value })} placeholder="Product code" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Cost Price (NGN)</label>
              <Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Selling Price (NGN)</label>
              <Input type="number" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Commission (NGN)</label>
              <Input type="number" step="0.01" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Cashback Rate (%)</label>
              <Input type="number" step="0.01" value={form.cashback_rate_percent} onChange={(e) => setForm({ ...form, cashback_rate_percent: e.target.value })} placeholder="Optional" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm">Active</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.cashback_enabled} onCheckedChange={(v) => setForm({ ...form, cashback_enabled: v })} />
              <span className="text-sm">Cashback enabled</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); setCreateOpen(false); }}>Cancel</Button>
            <Button loading={saving} onClick={() => handleSave(createOpen)}>
              {createOpen ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteProduct !== null} onOpenChange={(open) => { if (!open) setDeleteProduct(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove product</DialogTitle>
            <DialogDescription>
              &ldquo;{deleteProduct?.name}&rdquo; will be deactivated and hidden from the catalogue.
              Historical transactions are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProduct(null)}>Cancel</Button>
            <Button variant="destructive" loading={deleting} onClick={handleDelete}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
