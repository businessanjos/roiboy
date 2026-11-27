import { visiblePeopleQuery } from "@/lib/peopleVisibility";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useActiveSalesClosers } from "@/lib/sales/salesClosers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save, ChevronLeft, ChevronRight, User, Hash, DollarSign } from "lucide-react";
import { useQuotasIncentives } from "@/hooks/useQuotasIncentives";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/ui/skeleton";
import { usePagedList } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";
import { useIsMobile } from "@/hooks/use-mobile";
import { MoneyInput } from "@/components/sales/InlineFieldInput";
import { resolveRawToProductId } from "@/lib/insights/productLabelResolver";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  currentProductId, quotaAttainment, quotaColumns, quotaGoal, quotaProductsForCompany, quotaRemaining, sumAmounts,
  type QuotaAmount, type QuotaProduct, type QuotaView,
} from "@/lib/sales/quotaBoard";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Closers ativos vêm dinamicamente do RH (useActiveSalesClosers).
// Gerente e Sócios seguem fixos porque não têm cargo de closer no RH.
const EXTRA_SALES_USER_IDS = [
  "de43a643-0109-4afb-ac35-be768dbf4090", // Everton Pieri
  "1232ec15-5f66-4b5f-9e74-f40d436f9d0f", // Jonathan Marcato
  "d20201f6-a9bd-4934-ae50-07ce7a47574b", // Maikol Parnow
];

const ITEM_VENDA_FIELD_ID = "033b91fb-3add-4c96-aec9-567fefbd0fb2";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtCompactBRL = (v: number) =>
  `R$ ${new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;
const fmtAmount = (a: QuotaAmount, view: QuotaView, compact = false) =>
  view === "quantity" ? String(a.quantity) : compact ? fmtCompactBRL(a.value) : fmtBRL(a.value);
const fmtPercent = (v: number | null) => (v === null ? "—" : `${v.toFixed(0)}%`);

const VIEW_OPTIONS: { value: QuotaView; label: string; icon: typeof Hash }[] = [
  { value: "quantity", label: "Quantidade", icon: Hash },
  { value: "value", label: "R$", icon: DollarSign },
];

function ProductTag({ label, title, color }: { label: string; title?: string; color: string | null }) {
  const c = color || "#6b7280";
  return (
    <Badge
      variant="outline"
      title={title}
      className="whitespace-nowrap border font-medium"
      style={{ color: c, borderColor: `${c}66`, backgroundColor: `${c}14` }}
    >
      {label}
    </Badge>
  );
}

/** Realizado sobre a meta; sem venda e sem meta a célula fica vazia. */
function QuotaCell({ achieved, goal, view }: { achieved: QuotaAmount; goal: QuotaAmount; view: QuotaView }) {
  if (!(achieved[view] > 0) && !(goal[view] > 0)) return <span className="text-muted-foreground/60">—</span>;
  const meta = goal[view] > 0 ? fmtAmount(goal, view, true) : "sem meta";
  if (view === "quantity") {
    return (
      <>
        <span className="font-semibold">{achieved.quantity}</span>
        <span className="text-muted-foreground"> / {goal.quantity > 0 ? goal.quantity : "—"}</span>
      </>
    );
  }
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className="font-semibold">{fmtAmount(achieved, view, true)}</span>
      <span className="text-[10px] font-normal text-muted-foreground">{goal.value > 0 ? `de ${meta}` : meta}</span>
    </div>
  );
}

export function QuotasSection() {
  const isMobile = useIsMobile();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const queryClient = useQueryClient();

  const { quotas, loading } = useQuotasIncentives(year, month);

  const closersQuery = useActiveSalesClosers();
  const closerIds = (closersQuery.data ?? []).map((c) => c.userId);

  const usersQuery = useQuery({
    queryKey: ["sales-team-users", accountId, "v3-dynamic", closerIds.join(",")],
    queryFn: async () => {
      const ids = Array.from(new Set([...closerIds, ...EXTRA_SALES_USER_IDS]));
      const { data, error } = await visiblePeopleQuery(supabase
        .from("users")
        .select("id, name, is_active"))
        .eq("account_id", accountId!)
        .in("id", ids)
        .order("name");
      if (error) throw error;
      return (data ?? []).filter((u: any) => u.is_active !== false);
    },
    enabled: !!accountId && !closersQuery.isLoading,
  });

  const productsQuery = useQuery({
    queryKey: ["quota-products", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, company_id, is_active, is_renewal, color")
        .eq("account_id", accountId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as QuotaProduct[];
    },
    enabled: !!accountId,
  });

  const companiesQuery = useQuery({
    queryKey: ["quota-companies", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, trade_name, legal_name")
        .eq("account_id", accountId!)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []).map((c) => ({ id: c.id, name: (c.trade_name || c.legal_name || "Empresa").trim() }));
    },
    enabled: !!accountId,
  });

  // Fetch won deals for the selected month, grouped by user and product
  // Uses Brasília timezone (UTC-3) for date boundaries
  const wonDealsQuery = useQuery({
    queryKey: ["won-deals-by-product", accountId, year, month],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01T03:00:00.000Z`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01T03:00:00.000Z`;

      const { data, error } = await supabase
        .from("deals")
        .select("id, responsible_user_id, won_at, value")
        .eq("account_id", accountId!)
        .eq("status", "won")
        .gte("won_at", startDate)
        .lt("won_at", endDate);
      if (error) throw error;

      const achieved: Record<string, QuotaAmount> = {};
      if (!data || data.length === 0) return achieved;

      const dealIds = data.map((d) => d.id);
      const { data: fieldValues, error: fvError } = await supabase
        .from("deal_field_values")
        .select("deal_id, value_text")
        .eq("field_id", ITEM_VENDA_FIELD_ID)
        .in("deal_id", dealIds);
      if (fvError) throw fvError;

      // deal_id -> produto atual (slug antigo e Rykas Mentoring caem no produto de hoje)
      const dealProductMap: Record<string, string> = {};
      for (const fv of fieldValues || []) {
        dealProductMap[fv.deal_id] = resolveRawToProductId(fv.value_text) ?? "";
      }

      for (const deal of data) {
        const productId = dealProductMap[deal.id];
        if (!productId || !deal.responsible_user_id) continue;
        const key = `${deal.responsible_user_id}_${productId}`;
        const prev = achieved[key] ?? { quantity: 0, value: 0 };
        achieved[key] = { quantity: prev.quantity + 1, value: prev.value + Number(deal.value || 0) };
      }
      return achieved;
    },
    enabled: !!accountId,
  });

  // Realtime: refetch when deals or goals change
  useEffect(() => {
    if (!accountId) return;
    const channel = supabase
      .channel(`quotas-section-${accountId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, () => {
        queryClient.invalidateQueries({ queryKey: ["won-deals-by-product", accountId, year, month] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_field_values" }, () => {
        queryClient.invalidateQueries({ queryKey: ["won-deals-by-product", accountId, year, month] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_quotas" }, () => {
        queryClient.invalidateQueries({ queryKey: ["sales-quotas"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, year, month, queryClient]);

  const users = usersQuery.data ?? [];
  const allProducts = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const achievedMap = wonDealsQuery.data ?? {};

  // Empresas: a que tem mais produtos vem primeiro e recebe os produtos sem empresa.
  const companies = useMemo(() => {
    const count = (id: string) => allProducts.filter((p) => p.is_active && p.company_id === id).length;
    return [...(companiesQuery.data ?? [])].sort((a, b) => count(b.id) - count(a.id) || a.name.localeCompare(b.name, "pt-BR"));
  }, [companiesQuery.data, allProducts]);
  const fallbackCompanyId = companies[0]?.id ?? null;
  const requestedCompany = searchParams.get("empresa");
  const companyId = companies.find((c) => c.id === requestedCompany)?.id ?? fallbackCompanyId ?? "";
  const view: QuotaView = searchParams.get("ver") === "valor" ? "value" : "quantity";

  const setParam = (key: string, value: string | null) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });

  const products = useMemo(
    () => (companies.length > 0
      ? quotaProductsForCompany(allProducts, companyId, fallbackCompanyId)
      : allProducts.filter((p) => p.is_active)),
    [allProducts, companies.length, companyId, fallbackCompanyId],
  );
  const columns = useMemo(() => quotaColumns(products), [products]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const goalOf = (userId: string, productId: string): QuotaAmount => {
    const product = productById.get(productId);
    return product ? quotaGoal(quotas, userId, product) : { quantity: 0, value: 0 };
  };
  const achievedOf = (userId: string, productId: string): QuotaAmount =>
    achievedMap[`${userId}_${productId}`] ?? { quantity: 0, value: 0 };

  // Rascunho do formulário individual
  const [draftQuotas, setDraftQuotas] = useState<Record<string, { quantity: number; value: number }>>({});
  const activeUser = selectedUserId ? users.find((u) => u.id === selectedUserId) : null;

  const getQuotaValue = (productId: string, field: "quantity" | "value") => {
    if (draftQuotas[productId]) return draftQuotas[productId][field];
    const product = productById.get(productId);
    if (!product) return 0;
    const row = quotas.filter((q) => q.user_id === selectedUserId && currentProductId(q.product_id) === productId);
    if (field === "quantity") return row.reduce((s, q) => s + (Number(q.target_quantity) || 0), 0);
    // No formulário aparece só o valor digitado, sem o cálculo automático.
    return row.reduce((s, q) => s + (Number(q.target_value) || 0), 0);
  };

  const updateDraft = (productId: string, patch: Partial<{ quantity: number; value: number }>) => {
    setDraftQuotas((prev) => ({
      ...prev,
      [productId]: {
        quantity: prev[productId]?.quantity ?? getQuotaValue(productId, "quantity"),
        value: prev[productId]?.value ?? getQuotaValue(productId, "value"),
        ...patch,
      },
    }));
  };

  const handleSaveAll = async () => {
    if (!selectedUserId || !accountId) return;
    setSaving(true);
    try {
      for (const [productId, draft] of Object.entries(draftQuotas)) {
        // Meta antiga gravada no produto legado é atualizada no lugar, sem duplicar.
        const existing = quotas.filter((q) => q.user_id === selectedUserId && currentProductId(q.product_id) === productId);
        if (existing.length > 0) {
          const [first, ...rest] = existing;
          const { error } = await supabase
            .from("sales_quotas")
            .update({ target_quantity: draft.quantity, target_value: draft.value })
            .eq("id", first.id);
          if (error) throw error;
          for (const extra of rest) {
            const { error: extraError } = await supabase
              .from("sales_quotas")
              .update({ target_quantity: 0, target_value: 0 })
              .eq("id", extra.id);
            if (extraError) throw extraError;
          }
        } else if (draft.quantity > 0 || draft.value > 0) {
          const { error } = await supabase.from("sales_quotas").insert({
            account_id: accountId,
            user_id: selectedUserId,
            product_id: productId,
            year,
            month,
            target_quantity: draft.quantity,
            target_value: draft.value,
          });
          if (error) throw error;
        }
      }
      setDraftQuotas({});
      toast.success("Metas salvas");
    } catch (err: any) {
      toast.error("Não foi possível salvar as metas: " + (err?.message ?? ""));
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["sales-quotas"] });
      setSaving(false);
    }
  };

  const handlePrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
    setDraftQuotas({});
  };

  const handleNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
    setDraftQuotas({});
  };

  // Linhas por vendedor
  const userRows = users.map((u) => {
    const cells = columns.map((col) => ({
      key: col.key,
      label: col.label,
      goal: sumAmounts(col.productIds.map((id) => goalOf(u.id, id))),
      achieved: sumAmounts(col.productIds.map((id) => achievedOf(u.id, id))),
    }));
    const goal = sumAmounts(cells.map((c) => c.goal));
    const achieved = sumAmounts(cells.map((c) => c.achieved));
    const attainment = quotaAttainment(goal, achieved, view);
    return { ...u, cells, goal, achieved, attainment, remaining: quotaRemaining(attainment) };
  });

  const userRowsPg = usePagedList(userRows, { resetKey: [year, month, companyId] });

  if (loading || usersQuery.isLoading || productsQuery.isLoading || companiesQuery.isLoading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-60" /><Skeleton className="h-64" /></div>;
  }

  // Totais do rodapé
  const footerCells = columns.map((col, i) => ({
    key: col.key,
    goal: sumAmounts(userRows.map((r) => r.cells[i].goal)),
    achieved: sumAmounts(userRows.map((r) => r.cells[i].achieved)),
  }));
  const footerGoal = sumAmounts(userRows.map((r) => r.goal));
  const footerAchieved = sumAmounts(userRows.map((r) => r.achieved));
  const footerAttainment = quotaAttainment(footerGoal, footerAchieved, view);
  const footerRemaining = quotaRemaining(footerAttainment);
  const unit = view === "quantity" ? "Qtd" : "R$";
  const companyName = companies.find((c) => c.id === companyId)?.name ?? "";
  const attainmentVariant = (v: number | null) => (v === null ? "outline" : v >= 100 ? "default" : v >= 80 ? "secondary" : "outline");
  const formTotals = {
    quantity: products.reduce((s, p) => s + getQuotaValue(p.id, "quantity"), 0),
    value: products.reduce((s, p) => s + getQuotaValue(p.id, "value"), 0),
  };

  const segmented = "inline-flex items-center gap-1 rounded-lg bg-muted p-1";
  const segment = (active: boolean) =>
    cn(
      "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="space-y-4">
      {/* Mês, empresa e visão */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-11 w-11 sm:h-10 sm:w-10" aria-label="Mês anterior" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-lg min-w-[120px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <Button variant="outline" size="icon" className="h-11 w-11 sm:h-10 sm:w-10" aria-label="Próximo mês" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {companies.length > 1 && (
            <div className={segmented} role="group" aria-label="Empresa">
              {companies.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={c.id === companyId}
                  className={segment(c.id === companyId)}
                  onClick={() => { setParam("empresa", c.id); setDraftQuotas({}); }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <div className={segmented} role="group" aria-label="Ver metas por">
            {VIEW_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={view === o.value}
                className={segment(view === o.value)}
                onClick={() => setParam("ver", o.value === "value" ? "valor" : null)}
              >
                <o.icon className="h-3.5 w-3.5" />
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Visão geral */}
      {!selectedUserId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Metas por Vendedor & Produto{companyName ? ` — ${companyName}` : ""}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Cada célula mostra o realizado sobre a meta do mês. Clique no vendedor para cadastrar quantidade e valor.
            </p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {columns.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum produto ativo nesta empresa. Vincule os produtos à empresa em Produtos para cadastrar metas.
              </p>
            ) : isMobile ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center">
                  <div><div className="text-[11px] text-muted-foreground">Meta</div><div className="text-sm font-semibold tabular-nums">{fmtAmount(footerGoal, view, true)}</div></div>
                  <div><div className="text-[11px] text-muted-foreground">Realizado</div><div className="text-sm font-semibold tabular-nums text-success">{fmtAmount(footerAchieved, view, true)}</div></div>
                  <div><div className="text-[11px] text-muted-foreground">Atingido</div><div className="text-sm font-semibold tabular-nums">{fmtPercent(footerAttainment)}</div></div>
                </div>
                <ul role="list" className="overflow-hidden rounded-[18px] border border-border/60 [&>li+li]:border-t [&>li+li]:border-border/60">
                  {userRowsPg.items.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        className="w-full min-h-[64px] px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        onClick={() => { setSelectedUserId(u.id); setDraftQuotas({}); }}
                        aria-label={`Editar metas de ${u.name}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm line-clamp-2 break-words">{u.name}</span>
                          <Badge variant={attainmentVariant(u.attainment)} className="shrink-0 text-[11px]">
                            {fmtPercent(u.attainment)}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                          <span>Meta {u.goal[view] > 0 ? fmtAmount(u.goal, view, true) : "—"}</span>
                          <span className="text-success font-medium">{u.achieved[view] > 0 ? fmtAmount(u.achieved, view, true) : "—"}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {u.cells.map((c) => (
                            <span key={c.key} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] tabular-nums">
                              {c.label} {fmtAmount(c.achieved, view, true)}/{fmtAmount(c.goal, view, true)}
                            </span>
                          ))}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col.key} className="text-center text-xs px-2">
                        <ProductTag label={col.label} title={col.title} color={col.color} />
                      </TableHead>
                    ))}
                    <TableHead className="text-right text-xs whitespace-nowrap px-2">Meta Total ({unit})</TableHead>
                    <TableHead className="text-right text-xs whitespace-nowrap px-2">Realizado ({unit})</TableHead>
                    <TableHead className="text-center text-xs px-2">Atingido</TableHead>
                    <TableHead className="text-center text-xs px-2">Falta</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRowsPg.items.map((u) => (
                    <TableRow key={u.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedUserId(u.id); setDraftQuotas({}); }}>
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {u.name.split(" ")[0]}
                        </div>
                      </TableCell>
                      {u.cells.map((c) => (
                        <TableCell key={c.key} className="text-center text-xs px-2 tabular-nums whitespace-nowrap">
                          <QuotaCell achieved={c.achieved} goal={c.goal} view={view} />
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-xs font-medium whitespace-nowrap tabular-nums px-2">
                        {u.goal[view] > 0 ? fmtAmount(u.goal, view) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold text-success whitespace-nowrap tabular-nums px-2">
                        {u.achieved[view] > 0 ? fmtAmount(u.achieved, view) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={attainmentVariant(u.attainment)} className="text-[10px] px-1.5">
                          {fmtPercent(u.attainment)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={u.remaining === 0 ? "default" : "outline"} className="text-[10px] px-1.5">
                          {fmtPercent(u.remaining)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-1 text-right">
                        <Button size="sm" variant="ghost" className="text-xs px-2">Editar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-bold text-xs tabular-nums">
                    <td className="py-2 px-4">Total</td>
                    {footerCells.map((fc) => (
                      <td key={fc.key} className="py-2 text-center whitespace-nowrap">
                        <QuotaCell achieved={fc.achieved} goal={fc.goal} view={view} />
                      </td>
                    ))}
                    <td className="py-2 text-right px-2 whitespace-nowrap">{footerGoal[view] > 0 ? fmtAmount(footerGoal, view) : "—"}</td>
                    <td className="py-2 text-right px-2 whitespace-nowrap text-success">{fmtAmount(footerAchieved, view)}</td>
                    <td className="py-2 text-center">
                      <Badge variant={attainmentVariant(footerAttainment)} className="text-[10px] px-1.5">
                        {fmtPercent(footerAttainment)}
                      </Badge>
                    </td>
                    <td className="py-2 text-center">
                      <Badge variant={footerRemaining === 0 ? "default" : "outline"} className="text-[10px] px-1.5">
                        {fmtPercent(footerRemaining)}
                      </Badge>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </Table>
            </div>
            )}
            {userRows.length > 0 && columns.length > 0 && <PagerFor state={userRowsPg} itemLabel="vendedores" />}
          </CardContent>
        </Card>
      )}

      {/* Formulário do vendedor */}
      {selectedUserId && activeUser && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <Button variant="ghost" size="sm" onClick={() => { setSelectedUserId(""); setDraftQuotas({}); }}>
                  ← Voltar
                </Button>
                <CardTitle className="text-base">
                  {activeUser.name} — Metas {MONTHS[month - 1]} {year}{companyName ? ` · ${companyName}` : ""}
                </CardTitle>
              </div>
              <Button onClick={handleSaveAll} disabled={Object.keys(draftQuotas).length === 0 || saving} className="gap-1.5">
                <Save className="h-4 w-4" />
                Salvar metas
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Informe a quantidade, o valor em reais ou os dois. Ao digitar a quantidade, o valor é sugerido pelo preço do produto e pode ser ajustado.
            </p>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum produto ativo nesta empresa.</p>
            ) : (
            <>
            <div className="w-full overflow-x-auto"><Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Preço unitário</TableHead>
                  <TableHead className="text-center w-[130px]">Meta em quantidade</TableHead>
                  <TableHead className="text-right w-[210px]">Meta em R$</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const qty = getQuotaValue(product.id, "quantity");
                  const val = getQuotaValue(product.id, "value");
                  return (
                    <TableRow key={product.id}>
                      <TableCell><ProductTag label={product.name} color={product.color ?? null} /></TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtBRL(Number(product.price) || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          aria-label={`Meta em quantidade de ${product.name}`}
                          className="w-20 text-center mx-auto"
                          value={qty || ""}
                          onChange={(e) => {
                            const q = Math.max(0, parseInt(e.target.value) || 0);
                            updateDraft(product.id, { quantity: q, value: q * (Number(product.price) || 0) });
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="ml-auto w-48">
                          <MoneyInput
                            aria-label={`Meta em reais de ${product.name}`}
                            className="text-right"
                            value={val || null}
                            onChange={(next) => updateDraft(product.id, { value: next ?? 0 })}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table></div>
            <div className="mt-4 pt-3 border-t flex flex-wrap justify-end items-center gap-x-8 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                Total em quantidade: <span className="font-bold text-foreground tabular-nums">{formTotals.quantity}</span>
              </span>
              <span className="text-muted-foreground">
                Total em R$: <span className="font-bold text-lg text-foreground tabular-nums">{fmtBRL(formTotals.value)}</span>
              </span>
            </div>
            </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
