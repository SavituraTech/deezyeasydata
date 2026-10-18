"use client";

import * as React from "react";
import Link from "next/link";
import {
  Smartphone,
  Wifi,
  Zap,
  Tv,
  Globe,
  GraduationCap,
  PlayCircle,
  Users,
  Search,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFetch } from "@/hooks/use-api";
import { formatNaira, toArray } from "@/lib/utils";
import { getProductLogo } from "@/data/service-images";
import { ProductLogo } from "@/components/dashboard/product-logo";
import type { ApiProduct, PaginatedResponse, ProductCategory } from "@/lib/api";

const CATEGORY_ORDER: ProductCategory[] = ["AIRTIME", "DATA", "SME_DATA", "ELECTRICITY", "CABLE", "BROADBAND", "EDUCATION", "STREAMING"];

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Smartphone; color: string; bg: string; href: string }> = {
  AIRTIME: { label: "Airtime", icon: Smartphone, color: "text-[var(--color-action)]", bg: "bg-[var(--color-action-subtle)]", href: "/dashboard/airtime" },
  DATA: { label: "Data", icon: Wifi, color: "text-amber-600", bg: "bg-amber-50", href: "/dashboard/data" },
  SME_DATA: { label: "SME Data", icon: Users, color: "text-blue-600", bg: "bg-blue-50", href: "/dashboard/data" },
  ELECTRICITY: { label: "Electricity", icon: Zap, color: "text-[var(--color-action)]", bg: "bg-[var(--color-action-subtle)]", href: "/dashboard/electricity" },
  CABLE: { label: "Cable TV", icon: Tv, color: "text-amber-600", bg: "bg-amber-50", href: "/dashboard/cable-tv" },
  BROADBAND: { label: "Broadband", icon: Globe, color: "text-[var(--color-action)]", bg: "bg-[var(--color-action-subtle)]", href: "/dashboard/broadband" },
  EDUCATION: { label: "Education", icon: GraduationCap, color: "text-amber-600", bg: "bg-amber-50", href: "/dashboard/education" },
  STREAMING: { label: "Streaming", icon: PlayCircle, color: "text-purple-600", bg: "bg-purple-50", href: "/dashboard" },
};

const NETWORK_ORDER = ["MTN", "AIRTEL", "GLO", "9MOBILE"];

const NETWORK_BADGE: Record<string, string> = {
  MTN: "bg-[var(--color-accent)]-100 text-[var(--color-accent)]-800 border-yellow-200",
  AIRTEL: "bg-red-50 text-red-700 border-red-200",
  GLO: "bg-green-50 text-green-700 border-green-200",
  "9MOBILE": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function ProductImage({ product, size = "md" }: { product: ApiProduct; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-10 w-10" : "h-14 w-14";
  const logoUrl = product.image_url || getProductLogo(product);

  if (logoUrl) {
    return (
      <span className={`relative flex shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-elevated)] overflow-hidden border border-border ${dims}`}>
        <ProductLogo
          product={product}
          alt={product.name}
          className="h-full w-full object-contain p-1"
        />
        <FallbackIcon product={product} className="absolute inset-0 hidden" />
      </span>
    );
  }

  return (
    <span className={`relative flex shrink-0 items-center justify-center rounded-xl ${dims}`}>
      <FallbackIcon product={product} />
    </span>
  );
}

function FallbackIcon({ product, className }: { product: ApiProduct; className?: string }) {
  const cfg = CATEGORY_CONFIG[product.category];
  const Icon = cfg?.icon || Smartphone;
  return (
    <span className={`flex h-full w-full items-center justify-center rounded-xl ${cfg?.bg || "bg-muted"} ${className || ""}`}>
      <Icon className={`h-5 w-5 ${cfg?.color || "text-muted-foreground"}`} />
    </span>
  );
}

export function ProductCatalogView() {
  const { data: products, loading } = useFetch<ApiProduct[]>("/api/products/");
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [networkFilter, setNetworkFilter] = React.useState<string>("all");

  const allProducts = toArray(products).filter((p: ApiProduct) => p.is_active);

  const categories = React.useMemo(() => {
    const cats = new Set(allProducts.map((p: ApiProduct) => p.category));
    return CATEGORY_ORDER.filter((c) => cats.has(c));
  }, [allProducts]);

  const networks = React.useMemo(() => {
    const nets = new Set(allProducts.filter((p: ApiProduct) => p.network).map((p: ApiProduct) => p.network!));
    return NETWORK_ORDER.filter((n) => nets.has(n));
  }, [allProducts]);

  const filtered = allProducts.filter((p: ApiProduct) => {
    if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
    if (networkFilter !== "all" && p.network !== networkFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !p.name.toLowerCase().includes(q) &&
        !(p.network || "").toLowerCase().includes(q) &&
        !(p.provider || "").toLowerCase().includes(q) &&
        !(p.description || "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const grouped = React.useMemo(() => {
    const map = new Map<string, ApiProduct[]>();
    for (const p of filtered) {
      const list = map.get(p.category) || [];
      list.push(p);
      map.set(p.category, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const ai = NETWORK_ORDER.indexOf(a.network ?? "");
        const bi = NETWORK_ORDER.indexOf(b.network ?? "");
        if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        // Same network: cheapest first, then alphabetical as tiebreaker.
        const pa = Number(a.selling_price) || 0;
        const pb = Number(b.selling_price) || 0;
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name);
      });
    }
    const sorted = new Map<string, ApiProduct[]>();
    for (const cat of CATEGORY_ORDER) {
      if (map.has(cat)) sorted.set(cat, map.get(cat)!);
    }
    for (const [cat, items] of map) {
      if (!sorted.has(cat)) sorted.set(cat, items);
    }
    return sorted;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Browse all available services and products."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={(e) => e.preventDefault()} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11"
          />
        </form>
        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_CONFIG[c]?.label || c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={networkFilter} onValueChange={setNetworkFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Network" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All networks</SelectItem>
              {networks.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex gap-3">
                <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-16 mt-1" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No products found matching your filters.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([category, items]) => {
            const cfg = CATEGORY_CONFIG[category];
            return (
              <div key={category}>
                <div className="mb-3 flex items-center gap-3">
                  {cfg ? (
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${cfg.bg}`}>
                      <cfg.icon className={`h-5 w-5 ${cfg.color}`} />
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <h2 className="font-semibold text-foreground">{cfg?.label || category}</h2>
                    <p className="text-xs text-muted-foreground">{items.length} plan{items.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => (
                    <Card key={p.id} className="group p-0 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-action)]/40 hover:shadow-lg overflow-hidden">
                      <div className="flex items-stretch">
                        <div className="flex shrink-0 items-center justify-center bg-muted/50 px-4">
                          <ProductImage product={p} />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-between p-4 pl-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="truncate font-semibold text-foreground">{p.name}</h3>
                              {p.network && (
                                <Badge variant="outline" className={`shrink-0 border text-[10px] font-bold ${NETWORK_BADGE[p.network] || "bg-muted text-muted-foreground"}`}>
                                  {p.network}
                                </Badge>
                              )}
                            </div>
                            {p.data_size ? (
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                {p.data_size}{p.data_validity ? ` · ${p.data_validity}` : ""}
                              </p>
                            ) : p.description ? (
                              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{p.description}</p>
                            ) : null}
                            <p className="mt-0.5 text-xs text-muted-foreground">{p.provider}</p>
                          </div>
                          <div className="mt-2 flex items-end justify-between">
                            <div>
                              <p className="text-lg font-bold leading-tight text-foreground">{formatNaira(Number(p.selling_price))}</p>
                              {Number(p.commission) > 0 && (
                                <p className="text-[11px] text-success">+{formatNaira(Number(p.commission))} cashback</p>
                              )}
                            </div>
                            <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs group-hover:text-[var(--color-action)]">
                              <Link href={cfg?.href || "/dashboard"}>
                                Buy
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
