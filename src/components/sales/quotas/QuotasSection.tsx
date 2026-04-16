import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save, ChevronLeft, ChevronRight, User } from "lucide-react";
import { useQuotasIncentives, SalesQuota } from "@/hooks/useQuotasIncentives";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Skeleton } from "@/components/ui/skeleton";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Sales team member IDs based on known commercial team
const SALES_USER_IDS = [
  "de43a643-0109-4afb-ac35-be768dbf4090", // Everton
  "1232ec15-5f66-4b5f-9e74-f40d436f9d0f", // Jonathan
  "d20201f6-a9bd-4934-ae50-07ce7a47574b", // Maikol
  "1d090543-1853-4cd0-bdb4-02e17a5df4d8", // Darlan
  "1ac1c97c-bff6-4174-b48c-9b524b404ce6", // Vanessa
  "cefc44c7-d2e2-4937-94ac-069c1c94731b", // George
];

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

  const users = usersQuery.data ?? [];
  const products = productsQuery.data ?? [];

  // Local draft state for the form
  const [draftQuotas, setDraftQuotas] = useState<Record<string, { quantity: number; value: number }>>({});

  const activeUser = selectedUserId ? users.find((u) => u.id === selectedUserId) : null;

  const userQuotas = useMemo(() => {
    if (!selectedUserId) return [];
    return quotas.filter((q) => q.user_id === selectedUserId);
  }, [quotas, selectedUserId]);

  // Initialize drafts when user changes
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

  // Summary per user for the overview
  const userSummaries = useMemo(() => {
    return users.map((u) => {
      const uq = quotas.filter((q) => q.user_id === u.id);
      const totalTarget = uq.reduce((s, q) => s + Number(q.target_value), 0);
      const totalAchieved = uq.reduce((s, q) => s + Number(q.achieved_value), 0);
      const productCount = uq.filter((q) => Number(q.target_value) > 0).length;
      return { ...u, totalTarget, totalAchieved, productCount };
    });
  }, [users, quotas]);

  if (loading || usersQuery.isLoading || productsQuery.isLoading) {
    return <div className="space-y-3"><Skeleton className="h-10 w-60" /><Skeleton className="h-64" /></div>;
  }

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
            <CardTitle className="text-base">Visão Geral — Quotas por Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-center">Produtos c/ Meta</TableHead>
                  <TableHead className="text-right">Meta Total (R$)</TableHead>
                  <TableHead className="text-right">Realizado (R$)</TableHead>
                  <TableHead className="text-right">Atingimento</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userSummaries.map((u) => {
                  const pct = u.totalTarget > 0 ? (u.totalAchieved / u.totalTarget) * 100 : 0;
                  return (
                    <TableRow key={u.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedUserId(u.id); setDraftQuotas({}); }}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {u.name}
                      </TableCell>
                      <TableCell className="text-center">{u.productCount}</TableCell>
                      <TableCell className="text-right">
                        {u.totalTarget > 0 ? `R$ ${u.totalTarget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.totalAchieved > 0 ? `R$ ${u.totalAchieved.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.totalTarget > 0 ? (
                          <Badge variant={pct >= 100 ? "default" : pct >= 80 ? "secondary" : "outline"}>
                            {pct.toFixed(0)}%
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost">Editar</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
                        {Number(product.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          className="w-20 text-center mx-auto"
                          value={qty || ""}
                          onChange={(e) => {
                            const q = parseInt(e.target.value) || 0;
                            const autoVal = q * Number(product.price);
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
