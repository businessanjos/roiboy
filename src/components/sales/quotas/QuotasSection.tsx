import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save, ChevronLeft, ChevronRight, User } from "lucide-react";
import { useQuotasIncentives } from "@/hooks/useQuotasIncentives";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/ui/skeleton";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Time comercial com metas individuais por produto.
// Inclui Closers (Darlan, Vanessa), Gerente (Jonathan) e Sócios (Everton, Maikol).
const SALES_USER_IDS = [
  "1d090543-1853-4cd0-bdb4-02e17a5df4d8", // Darlan Ferreira
  "1ac1c97c-bff6-4174-b48c-9b524b404ce6", // Vanessa Minelli
  "de43a643-0109-4afb-ac35-be768dbf4090", // Everton Pieri
  "1232ec15-5f66-4b5f-9e74-f40d436f9d0f", // Jonathan Marcato
  "d20201f6-a9bd-4934-ae50-07ce7a47574b", // Maikol Parnow
];

const TRACKED_PRODUCTS = [
  { id: "8d3e9bb6-054b-44b3-952f-5920e0ed8775", short: "Rykas" },
  { id: "b8c50eca-6fd9-41ac-a1d3-f78086daaea7", short: "Eternum Club" },
  { id: "8e8b0cc7-6965-4241-9aab-b959e7fc7893", short: "Eternum MVP" },
  { id: "abf8cd6f-3399-4af4-92c6-50fc1a966243", short: "Conselho" },
];

const ITEM_VENDA_FIELD_ID = "033b91fb-3add-4c96-aec9-567fefbd0fb2";

export function QuotasSection() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const { quotas, loading, upsertQuota } = useQuotasIncentives(year, month);

  const usersQuery = useQuery({
    queryKey: ["sales-team-users", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .eq("account_id", accountId!)
        .in("id", SALES_USER_IDS)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const productsQuery = useQuery({
    queryKey: ["active-products", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("account_id", accountId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Fetch product goals from sales_product_goals
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const productGoalsQuery = useQuery({
    queryKey: ["sales-product-goals-overview", accountId, yearMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_product_goals")
        .select("*")
        .eq("account_id", accountId!)
        .eq("year_month", yearMonth);
      if (error) throw error;
      return data as { product_id: string; user_id: string; target_quantity: number }[];
    },
    enabled: !!accountId,
  });

  // Fetch won deals for the selected month, grouped by user and product
  // Uses Brasília timezone (UTC-3) for date boundaries
  const wonDealsQuery = useQuery({
    queryKey: ["won-deals-by-product", accountId, year, month],
    queryFn: async () => {
      // Build UTC boundaries for the month in Brasília time (UTC-3)
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

      if (!data || data.length === 0) return { counts: {} as Record<string, number>, values: {} as Record<string, number> };

      // Fetch field values for these deals
      const dealIds = data.map((d) => d.id);
      const { data: fieldValues, error: fvError } = await supabase
        .from("deal_field_values")
        .select("deal_id, value_text")
        .eq("field_id", ITEM_VENDA_FIELD_ID)
        .in("deal_id", dealIds);
      if (fvError) throw fvError;

      // Build map: deal_id -> product_id
      const dealProductMap: Record<string, string> = {};
      for (const fv of fieldValues || []) {
        dealProductMap[fv.deal_id] = fv.value_text || "";
      }

      // Aggregate counts and actual values
      const counts: Record<string, number> = {};
      const values: Record<string, number> = {};
      for (const deal of data) {
        const productId = dealProductMap[deal.id];
        if (!productId || !deal.responsible_user_id) continue;
        const key = `${deal.responsible_user_id}_${productId}`;
        counts[key] = (counts[key] || 0) + 1;
        values[key] = (values[key] || 0) + Number(deal.value || 0);
      }
      return { counts, values };
    },
    enabled: !!accountId,
  });

  const users = usersQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const productGoals = productGoalsQuery.data ?? [];
  const wonCounts = wonDealsQuery.data?.counts ?? {};
  const wonValues = wonDealsQuery.data?.values ?? {};

  const getGoalQty = (userId: string, productId: string) => {
    const q = quotas.find((q) => q.user_id === userId && q.product_id === productId);
    return q?.target_quantity ?? 0;
  };

  const getWonQty = (userId: string, productId: string) => {
    return wonCounts[`${userId}_${productId}`] ?? 0;
  };

  const getWonValue = (userId: string, productId: string) => {
    return wonValues[`${userId}_${productId}`] ?? 0;
  };

  // Local draft state for the individual form
  const [draftQuotas, setDraftQuotas] = useState<Record<string, { quantity: number; value: number }>>({});
  const activeUser = selectedUserId ? users.find((u) => u.id === selectedUserId) : null;

  const userQuotas = useMemo(() => {
    if (!selectedUserId) return [];
    return quotas.filter((q) => q.user_id === selectedUserId);
  }, [quotas, selectedUserId]);

  const getQuotaValue = (productId: string, field: "quantity" | "value") => {
    const key = `${productId}`;
    if (draftQuotas[key]) return draftQuotas[key][field];
    const existing = userQuotas.find((q) => q.product_id === productId);
    return existing ? (field === "quantity" ? existing.target_quantity : existing.target_value) : 0;
  };

  const updateDraft = (productId: string, field: "quantity" | "value", val: number) => {
    setDraftQuotas((prev) => ({
      ...prev,
      [productId]: {
        quantity: field === "quantity" ? val : (prev[productId]?.quantity ?? getQuotaValue(productId, "quantity")),
        value: field === "value" ? val : (prev[productId]?.value ?? getQuotaValue(productId, "value")),
      },
    }));
  };

  const handleSaveAll = async () => {
    if (!selectedUserId) return;
    for (const product of products) {
      const key = product.id;
      const draft = draftQuotas[key];
      if (draft) {
        await upsertQuota.mutateAsync({
          user_id: selectedUserId,
          product_id: product.id,
          year,
          month,
          target_quantity: draft.quantity,
          target_value: draft.value,
        });
      }
    }
    setDraftQuotas({});
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

  if (loading || usersQuery.isLoading || productsQuery.isLoading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-60" /><Skeleton className="h-64" /></div>;
  }

  // Helper: get product price
  const getProductPrice = (productId: string) => {
    const p = products.find((pr) => pr.id === productId);
    return p ? (Number(p.price) || 0) : 0;
  };

  // Build user rows
  const userRows = users.map((u) => {
    const productCells = TRACKED_PRODUCTS.map((tp) => {
      const meta = getGoalQty(u.id, tp.id);
      const realizado = getWonQty(u.id, tp.id);
      return { id: tp.id, short: tp.short, meta, realizado };
    });
    const metaTotalValue = TRACKED_PRODUCTS.reduce((s, tp) => s + getGoalQty(u.id, tp.id) * getProductPrice(tp.id), 0);
    const realizadoTotalValue = TRACKED_PRODUCTS.reduce((s, tp) => s + getWonValue(u.id, tp.id), 0);
    const atingimento = metaTotalValue > 0 ? (realizadoTotalValue / metaTotalValue) * 100 : 0;
    const falta = Math.max(0, 100 - atingimento);
    return { ...u, productCells, metaTotalValue, realizadoTotalValue, atingimento, falta };
  });

  // Footer totals
  const footerProducts = TRACKED_PRODUCTS.map((tp) => ({
    id: tp.id,
    short: tp.short,
    meta: users.reduce((s, u) => s + getGoalQty(u.id, tp.id), 0),
    realizado: users.reduce((s, u) => s + getWonQty(u.id, tp.id), 0),
  }));
  const footerMetaTotal = userRows.reduce((s, r) => s + r.metaTotalValue, 0);
  const footerRealizadoTotal = userRows.reduce((s, r) => s + r.realizadoTotalValue, 0);
  const footerAtingimento = footerMetaTotal > 0 ? (footerRealizadoTotal / footerMetaTotal) * 100 : 0;
  const footerFalta = Math.max(0, 100 - footerAtingimento);

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-lg min-w-[120px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overview table */}
      {!selectedUserId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quotas por Vendedor — {MONTHS[month - 1]} {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    {TRACKED_PRODUCTS.map((tp) => (
                      <TableHead key={tp.id} className="text-center text-xs px-2">{tp.short}</TableHead>
                    ))}
                    <TableHead className="text-right text-xs">Meta Total (R$)</TableHead>
                    <TableHead className="text-right text-xs">Realizado (R$)</TableHead>
                    <TableHead className="text-center text-xs">Atingimento (%)</TableHead>
                    <TableHead className="text-center text-xs">Falta (%)</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRows.map((u) => (
                    <TableRow key={u.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedUserId(u.id); setDraftQuotas({}); }}>
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {u.name.split(" ")[0]}
                        </div>
                      </TableCell>
                      {u.productCells.map((c) => (
                        <TableCell key={c.id} className="text-center text-xs px-2">
                          <div className="flex flex-col items-center">
                            <span className="font-semibold">{c.realizado}/{c.meta}</span>
                          </div>
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-xs font-medium whitespace-nowrap">
                        {u.metaTotalValue > 0 ? fmtBRL(u.metaTotalValue) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold text-emerald-600 whitespace-nowrap">
                        {u.realizadoTotalValue > 0 ? fmtBRL(u.realizadoTotalValue) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={u.atingimento >= 100 ? "default" : u.atingimento >= 80 ? "secondary" : "outline"} className="text-[10px] px-1.5">
                          {u.atingimento.toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={u.falta <= 0 ? "default" : "outline"} className="text-[10px] px-1.5">
                          {u.falta.toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="text-xs">Editar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-bold text-xs">
                    <td className="py-2 px-4">Total</td>
                    {footerProducts.map((fp) => (
                      <td key={fp.id} className="py-2 text-center">
                        <span>{fp.realizado}/{fp.meta}</span>
                      </td>
                    ))}
                    <td className="py-2 text-right px-4 whitespace-nowrap">{fmtBRL(footerMetaTotal)}</td>
                    <td className="py-2 text-right px-4 whitespace-nowrap text-emerald-600">{fmtBRL(footerRealizadoTotal)}</td>
                    <td className="py-2 text-center">
                      <Badge variant={footerAtingimento >= 100 ? "default" : "secondary"} className="text-[10px] px-1.5">
                        {footerAtingimento.toFixed(0)}%
                      </Badge>
                    </td>
                    <td className="py-2 text-center">
                      <Badge variant={footerFalta <= 0 ? "default" : "outline"} className="text-[10px] px-1.5">
                        {footerFalta.toFixed(0)}%
                      </Badge>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual vendor form */}
      {selectedUserId && activeUser && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => { setSelectedUserId(""); setDraftQuotas({}); }}>
                  ← Voltar
                </Button>
                <CardTitle className="text-base">{activeUser.name} — Quotas {MONTHS[month - 1]} {year}</CardTitle>
              </div>
              <Button onClick={handleSaveAll} disabled={Object.keys(draftQuotas).length === 0 || upsertQuota.isPending} className="gap-1.5">
                <Save className="h-4 w-4" />
                Salvar Quotas
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Preço Unit. (R$)</TableHead>
                  <TableHead className="text-center w-[120px]">Meta Qtd</TableHead>
                  <TableHead className="text-right w-[180px]">Meta Valor (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const qty = getQuotaValue(product.id, "quantity");
                  const val = getQuotaValue(product.id, "value");
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {(Number(product.price) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          className="w-20 text-center mx-auto"
                          value={qty || ""}
                          onChange={(e) => {
                            const q = parseInt(e.target.value) || 0;
                            const autoVal = q * (Number(product.price) || 0);
                            updateDraft(product.id, "quantity", q);
                            updateDraft(product.id, "value", autoVal);
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step={100}
                          className="w-40 text-right ml-auto"
                          value={val || ""}
                          onChange={(e) => updateDraft(product.id, "value", parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-4 pt-3 border-t flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Total da Meta:</span>
              <span className="font-bold text-lg">
                R$ {products.reduce((s, p) => s + (getQuotaValue(p.id, "value")), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
