"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFetch } from "@/hooks/use-api";
import { formatDateTime, toArray } from "@/lib/utils";
import type { ApiProvider } from "@/lib/api";

function ProviderAvatarCell({ provider, initials }: { provider: ApiProvider; initials: string }) {
  const iconUrl = provider.metadata?.icon_url || provider.metadata?.logo_url;
  return iconUrl ? (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-elevated)] overflow-hidden border border-border">
      <img
        src={iconUrl}
        alt={provider.name}
        className="h-full w-full object-contain p-0.5"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    </span>
  ) : (
    <Avatar className="h-9 w-9">
      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
    </Avatar>
  );
}

export function ProvidersView() {
  const { data: providers, loading: providersLoading } =
    useFetch<ApiProvider[]>("/api/providers/");
  const { data: health, loading: healthLoading } =
    useFetch<ApiProvider[]>("/api/providers/admin/health-summary/");

  const providerList = toArray(providers);
  const healthList = toArray(health);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">All Providers</TabsTrigger>
          <TabsTrigger value="health">Health Check</TabsTrigger>
        </TabsList>

        <TabsContent value="providers">
          <Card className="p-5">
            <div className="overflow-x-auto">
              {providersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                  ))}
                </div>
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-3 font-medium">Provider</th>
                      <th className="pb-3 font-medium">Slug</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Base URL</th>
                      <th className="pb-3 font-medium">Timeout</th>
                      <th className="pb-3 text-right font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providerList.map((p) => {
                      const initials = p.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2);
                      return (
                        <tr key={p.id} className="border-b border-border last:border-0">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <ProviderAvatarCell provider={p} initials={initials} />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">
                                  {p.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  ID: {p.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge variant="outline">{p.slug}</Badge>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant={
                                p.status === "ACTIVE"
                                  ? "success"
                                  : p.status === "INACTIVE"
                                    ? "destructive"
                                    : "warning"
                              }
                            >
                              {p.status}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 max-w-[200px] truncate text-muted-foreground">
                            {p.base_url}
                          </td>
                          <td className="py-3 pr-4 text-foreground">
                            {p.timeout_seconds}s
                          </td>
                          <td className="py-3 pr-4 text-right text-muted-foreground">
                            {formatDateTime(p.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <Card className="p-5">
            <div className="overflow-x-auto">
              {healthLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                  ))}
                </div>
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-3 font-medium">Provider</th>
                      <th className="pb-3 font-medium">Slug</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Base URL</th>
                      <th className="pb-3 font-medium">Timeout</th>
                      <th className="pb-3 text-right font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {healthList.map((p) => {
                      const initials = p.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2);
                      return (
                        <tr key={p.id} className="border-b border-border last:border-0">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <ProviderAvatarCell provider={p} initials={initials} />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">
                                  {p.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  ID: {p.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge variant="outline">{p.slug}</Badge>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant={
                                p.status === "ACTIVE"
                                  ? "success"
                                  : p.status === "INACTIVE"
                                    ? "destructive"
                                    : "warning"
                              }
                            >
                              {p.status}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 max-w-[200px] truncate text-muted-foreground">
                            {p.base_url}
                          </td>
                          <td className="py-3 pr-4 text-foreground">
                            {p.timeout_seconds}s
                          </td>
                          <td className="py-3 pr-4 text-right text-muted-foreground">
                            {formatDateTime(p.updated_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
