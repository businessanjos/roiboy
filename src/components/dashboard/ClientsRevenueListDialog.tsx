import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TablePagination } from "@/components/ui/table-pagination";
import { useTablePagination } from "@/hooks/useTablePagination";
import { ArrowUpDown, Search, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

interface ClientRevenueRow {
  client_id: string;
  full_name: string;
  logo_url: string | null;
  product_name: string;
  product_color: string | null;
  period_total: number;
  last_month: string | null;
  last_month_revenue: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
  clientIds?: string[];
  productLabel?: string;
  periodFilter: string;
  customRange?: DateRange;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (m: string | null) => {
  if (!m) return "—";
  const [y, mm] = m.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(mm) - 1]}/${y.slice(2)}`;
};

function periodBounds(periodFilter: string, customRange?: DateRange): { from: string; to: string } {
  const now = new Date();
  const to = monthKey(now);
  switch (periodFilter) {
    case "7":
    case "month":
      return { from: to, to };
    case "3":
    case "6":
    case "12": {
      const n = Number(periodFilter);
      const start = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1);
      return { from: monthKey(start), to };
    }
    case "custom": {
      if (customRange?.from) {
        const end = customRange.to ?? customRange.from;
        return { from: monthKey(customRange.from), to: monthKey(end) };
      }
      return { from: `${now.getFullYear()}-01`, to };
    }
    default:
      return { from: `${now.getFullYear()}-01`, to };
  }
}

type SortKey = "name" | "period_total" | "last_month_revenue";

export function ClientsRevenueListDialog({
  open,
  onOpenChange,
  accountId,
  clientIds,
  productLabel,
  periodFilter,
  customRange,
}: Props) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "period_total", desc: true });

  const bounds = useMemo(() => periodBounds(periodFilter, customRange), [periodFilter, customRange]);

  const { data, isLoading } = useQuery({
    queryKey: ["clients-revenue-list-dialog", accountId, clientIds?.join(",")],
    enabled: open && !!accountId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const allowedIds = clientIds && clientIds.length > 0 ? clientIds : null;
      let clientQuery = supabase
        .from("clients")
        .select("id, full_name, logo_url")
        .eq("account_id", accountId!);
      if (allowedIds) {
        clientQuery = clientQuery.in("id", allowedIds);
      }
      const { data: clientsData, error: clientsError } = await clientQuery.order("full_name", { ascending: true });
      if (clientsError) throw clientsError;

      const ids = (clientsData ?? []).map((c) => c.id);
      if (ids.length === 0) return [];

      const BATCH = 200;
      const historyPromises: Promise<any[]>[] = [];
      const productsPromises: Promise<any[]>[] = [];
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        historyPromises.push(
          (async () => {
            const { data } = await supabase
              .from("client_revenue_history")
              .select("client_id, month, revenue")
              .eq("account_id", accountId!)
              .in("client_id", batch);
            return data || [];
          })()
        );
        productsPromises.push(
          (async () => {
            const { data } = await supabase
              .from("client_products")
              .select("client_id, product_id, products(name, color)")
              .in("client_id", batch);
            return data || [];
          })()
        );
      }

      const [historyResults, productsResults] = await Promise.all([
        Promise.all(historyPromises),
        Promise.all(productsPromises),
      ]);

      const historyRows = historyResults.flat();
      const productRows = productsResults.flat();

      const periodTotalsByClient: Record<string, number> = {};
      const lastRevenueByClient: Record<string, { month: string; revenue: number }> = {};
      for (const r of historyRows) {
        if (r.month >= bounds.from && r.month <= bounds.to) {
          periodTotalsByClient[r.client_id] = (periodTotalsByClient[r.client_id] || 0) + Number(r.revenue || 0);
        }
        const prev = lastRevenueByClient[r.client_id];
        if (!prev || r.month > prev.month) {
          lastRevenueByClient[r.client_id] = { month: r.month, revenue: Number(r.revenue || 0) };
        }
      }

      const productByClient: Record<string, { name: string; color: string | null }> = {};
      for (const pr of productRows) {
        const product = pr.products as { name: string; color: string | null } | null;
        if (!product || productByClient[pr.client_id]) continue;
        productByClient[pr.client_id] = { name: product.name, color: product.color };
      }

      return (clientsData ?? []).map((c) => {
        const last = lastRevenueByClient[c.id];
        return {
          client_id: c.id,
          full_name: c.full_name,
          logo_url: c.logo_url,
          product_name: productByClient[c.id]?.name || "—",
          product_color: productByClient[c.id]?.color || null,
          period_total: periodTotalsByClient[c.id] || 0,
          last_month: last?.month || null,
          last_month_revenue: last?.revenue || 0,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = (data ?? []).filter((r) =>
      q
        ? r.full_name.toLowerCase().includes(q) ||
          r.product_name.toLowerCase().includes(q)
        : true
    );
    rows.sort((a, b) => {
      const aVal = sort.key === "name" ? a.full_name : sort.key === "period_total" ? a.period_total : a.last_month_revenue;
      const bVal = sort.key === "name" ? b.full_name : sort.key === "period_total" ? b.period_total : b.last_month_revenue;
      if (aVal === bVal) return 0;
      const gt = aVal > bVal;
      return sort.desc ? (gt ? -1 : 1) : gt ? 1 : -1;
    });
    return rows;
  }, [data, search, sort]);

  const {
    paginatedItems,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    handlePageChange,
    handlePageSizeChange,
  } = useTablePagination(filtered, 20);


  const totals = useMemo(() => {
    return filtered.reduce((acc, r) => acc + r.period_total, 0);
  }, [filtered]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => ({ key, desc: prev.key === key ? !prev.desc : true }));
    handlePageChange(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 w-[calc(100vw-3rem)]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-lg">Clientes com faturamento informado</DialogTitle>
          <DialogDescription>
            {productLabel ? `Produto: ${productLabel}` : "Todos os produtos"} · {" "}
            {filtered.length} cliente(s) · total no período {brl(totals)}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou produto..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                handlePageChange(1);
              }}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  handlePageChange(1);
                }}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto overflow-x-auto w-full min-w-0">
          <div className="px-6 pb-6 min-w-0 w-full">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum cliente encontrado com faturamento para os filtros selecionados.
              </p>
            ) : (
              <div className="overflow-x-auto w-full min-w-0">
                <Table className="min-w-[900px] table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[260px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 -ml-2 font-medium"
                        onClick={() => toggleSort("name")}
                      >
                        Cliente
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[160px] text-center">Produto</TableHead>
                    <TableHead className="w-[180px] text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 -ml-2 font-medium"
                        onClick={() => toggleSort("period_total")}
                      >
                        Total no período
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[150px] text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 -ml-2 font-medium"
                        onClick={() => toggleSort("last_month_revenue")}
                        title="Último mês preenchido"
                      >
                        Último mês
                        <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((r) => (
                    <TableRow key={r.client_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border">
                            <AvatarImage src={r.logo_url || undefined} alt={r.full_name} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {r.full_name
                                .split(" ")
                                .slice(0, 2)
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium truncate">{r.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="text-xs font-medium whitespace-nowrap"
                          style={{
                            backgroundColor: r.product_color ? `${r.product_color}20` : undefined,
                            borderColor: r.product_color || "#6b7280",
                            color: r.product_color || "#6b7280",
                          }}
                        >
                          {r.product_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">{brl(r.period_total)}</TableCell>
                      <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                        {r.last_month_revenue > 0 ? brl(r.last_month_revenue) : "—"}
                        {r.last_month && r.last_month !== bounds.to && (
                          <span className="block text-[10px] text-muted-foreground">{monthLabel(r.last_month)}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
            {totalPages > 1 && (
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ClientsRevenueListDialog;
