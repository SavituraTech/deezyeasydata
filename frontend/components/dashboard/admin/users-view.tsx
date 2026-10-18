"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Search, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApi, getClientToken, type ApiUser } from "@/lib/api";
import { formatNaira, formatDate } from "@/lib/utils";

export function UsersView() {
  const [users, setUsers] = React.useState<ApiUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const pageSize = 20;

  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = getClientToken();
      if (!token) return;
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (search.trim()) params.search = search.trim();
      if (roleFilter !== "all") params.role = roleFilter;
      if (statusFilter !== "all") params.is_active = statusFilter === "active";
      const res = await adminApi.users(token, params as Parameters<typeof adminApi.users>[1]);
      setUsers(res?.results ?? []);
      setTotalCount(res?.count ?? 0);
    } catch {
      // handled by API layer
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11"
          />
        </form>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/admin/users/create">
              <UserPlus className="h-4 w-4" />
              Create user
            </Link>
          </Button>
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="AGENT">Agent</SelectItem>
              <SelectItem value="CUSTOMER">Customer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
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
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No users found.</p>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">User</th>
                  <th className="pb-3 pr-4 font-medium">Role</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 text-right font-medium">Balance</th>
                  <th className="pb-3 pr-4 font-medium">Joined</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const initials = (u.name || u.username || "U")
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);
                  return (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{u.name || u.username}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.email || u.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={u.role === "ADMIN" ? "teal" : "outline"}>
                          {u.role === "ADMIN" ? "Admin" : "User"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={u.status === "active" || !u.status ? "success" : "warning"}>
                          {u.status || "Active"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-right font-medium text-foreground">
                        {formatNaira(Number(u.balance))}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{formatDate(u.date_joined)}</td>
                      <td className="py-3 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dashboard/admin/users/${u.id}`}>
                            View
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
      </Card>
    </div>
  );
}
