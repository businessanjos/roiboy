import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Trophy, Plus, Trash2, Pencil, Target, TrendingDown, Star, Loader2, RefreshCw, Gift } from "lucide-react";
import { CsIncentivePlanSection } from "@/components/operations/CsIncentivePlanSection";
import {
  useConsultantGoals,
  METRIC_LABELS,
  MONTH_LABELS,
  type MetricType,
  type ConsultantGoal,
} from "@/hooks/useConsultantGoals";
import { ConsultantPayoutTable } from "@/components/operations/ConsultantPayoutTable";

const ALLOWED_VIEWERS = ["maikol", "jonathan", "everton", "bruna"];
const CONSULTANT_NAMES = ["andréia", "andreia", "dayara", "michele", "ana"];

const METRIC_ICONS: Record<MetricType, any> = {
  renewal_rate: Target,
  churn_rate: TrendingDown,
  nps: Star,
};

function canViewBonusArea(name: string | null | undefined, email: string | null | undefined) {
  const n = (name || "").toLowerCase();
  const e = (email || "").toLowerCase();
  return ALLOWED_VIEWERS.some((k) => n.includes(k) || e.includes(k));
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ConsultantBonus() {
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [year, setYear] = useState(new Date().getFullYear());
  const [recalculating, setRecalculating] = useState(false);
  const queryClient = useQueryClient();
  const { goals, isLoading, upsertGoal, deleteGoal } = useConsultantGoals(year);

  const { data: consultants = [] } = useQuery({
    queryKey: ["consultants-list", currentUser?.account_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, name, email")
        .order("name");
      return (data || []).filter((u: any) => {
        const n = (u.name || "").toLowerCase();
        return CONSULTANT_NAMES.some((k) => n.includes(k));
      });
    },
    enabled: !!currentUser?.account_id,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["bonus-products", currentUser?.account_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, color")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!currentUser?.account_id,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ConsultantGoal | null>(null);
  const [activeConsultant, setActiveConsultant] = useState<string | null>(null);

  if (userLoading) return null;
  if (!canViewBonusArea(currentUser?.name, currentUser?.email)) {
    return <Navigate to="/dashboard" replace />;
  }

  const goalsByConsultant = useMemo(() => {
    const map = new Map<string, ConsultantGoal[]>();
    for (const g of goals) {
      const arr = map.get(g.user_id) || [];
      arr.push(g);
      map.set(g.user_id, arr);
    }
    return map;
  }, [goals]);

  const totalBonusBudget = goals.reduce((sum, g) => sum + Number(g.bonus_amount || 0), 0);

  const openNew = (userId: string) => {
    setEditing({
      id: "",
      account_id: currentUser!.account_id!,
      user_id: userId,
      product_id: products[0]?.id || "",
      year,
      metric_type: "renewal_rate",
      annual_target: 0,
      monthly_targets: {},
      bonus_amount: 0,
      notes: null,
    });
    setDialogOpen(true);
  };

  const openEdit = (g: ConsultantGoal) => {
    setEditing(g);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    await upsertGoal.mutateAsync({
      user_id: editing.user_id,
      product_id: editing.product_id,
      metric_type: editing.metric_type,
      annual_target: editing.annual_target,
      monthly_targets: editing.monthly_targets,
      bonus_amount: editing.bonus_amount,
      notes: editing.notes,
    });
    setDialogOpen(false);
  };

  const updateMonthly = (idx: number, value: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      monthly_targets: { ...editing.monthly_targets, [String(idx)]: Number(value) || 0 },
    });
  };

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Trophy className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Premiação & Bônus</h1>
            <p className="text-sm text-muted-foreground">
              Metas e gatilhos de bonificação para o time de consultoras
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            disabled={recalculating}
            onClick={async () => {
              setRecalculating(true);
              try {
                const { data, error } = await (supabase as any).rpc(
                  "recalculate_consultant_bonus_payouts",
                  { p_year: year }
                );
                if (error) throw error;
                const processed = data?.[0]?.processed ?? 0;
                toast.success(`Recálculo concluído: ${processed} apuração(ões) atualizada(s).`);
                queryClient.invalidateQueries({ queryKey: ["consultant-bonus-payouts"] });
                queryClient.invalidateQueries({ queryKey: ["computed-consultant-metrics"] });
              } catch (e: any) {
                toast.error("Erro ao recalcular: " + (e?.message ?? "desconhecido"));
              } finally {
                setRecalculating(false);
              }
            }}
            className="gap-2"
          >
            {recalculating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Recalcular agora
          </Button>
          <span className="text-[10px] text-muted-foreground hidden md:inline">
            Job automático: diário 03:00 UTC
          </span>
          <Label className="text-sm">Ano:</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="bonus" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bonus" className="gap-1.5">
            <Trophy className="h-4 w-4" /> Premiação & Bônus
          </TabsTrigger>
          <TabsTrigger value="incentive" className="gap-1.5">
            <Gift className="h-4 w-4" /> Plano de Incentivo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bonus" className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Consultoras</div>
            <div className="text-2xl font-bold">{consultants.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Metas configuradas</div>
            <div className="text-2xl font-bold">{goals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Orçamento total de bônus</div>
            <div className="text-2xl font-bold text-amber-500">{formatBRL(totalBonusBudget)}</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs
          value={activeConsultant ?? consultants[0]?.id ?? ""}
          onValueChange={setActiveConsultant}
          className="w-full"
        >
          <TabsList className="flex-wrap h-auto">
            {consultants.map((c: any) => (
              <TabsTrigger key={c.id} value={c.id} className="gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px]">{initials(c.name)}</AvatarFallback>
                </Avatar>
                {c.name.split(" ")[0]}
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {goalsByConsultant.get(c.id)?.length || 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {consultants.map((c: any) => {
            const consultantGoals = goalsByConsultant.get(c.id) || [];
            return (
              <TabsContent key={c.id} value={c.id} className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold">{c.name}</h2>
                    <p className="text-sm text-muted-foreground">{c.email}</p>
                  </div>
                  <Button onClick={() => openNew(c.id)} className="gap-2">
                    <Plus className="h-4 w-4" /> Nova meta
                  </Button>
                </div>

                <Tabs defaultValue="metas">
                  <TabsList>
                    <TabsTrigger value="metas">Metas</TabsTrigger>
                    <TabsTrigger value="apuracao">Apuração & Bônus</TabsTrigger>
                  </TabsList>

                  <TabsContent value="metas" className="space-y-4 mt-4">
                    {consultantGoals.length === 0 ? (
                      <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                          Nenhuma meta configurada para {c.name.split(" ")[0]} em {year}.
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {consultantGoals.map((g) => {
                          const product = products.find((p: any) => p.id === g.product_id);
                          const Icon = METRIC_ICONS[g.metric_type];
                          const unit = g.metric_type === "nps" ? "" : "%";
                          return (
                            <Card key={g.id}>
                              <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                    <CardTitle className="text-base">
                                      {METRIC_LABELS[g.metric_type]}
                                    </CardTitle>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" onClick={() => openEdit(g)}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => deleteGoal.mutate(g.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <CardDescription className="flex items-center gap-2">
                                  <Badge
                                    style={{
                                      backgroundColor: (product as any)?.color || "#6b7280",
                                      color: "#fff",
                                    }}
                                  >
                                    {product?.name || "—"}
                                  </Badge>
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Meta anual</span>
                                  <span className="font-semibold">
                                    {g.annual_target}{unit}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Bônus / gatilho</span>
                                  <span className="font-semibold text-amber-500">
                                    {formatBRL(Number(g.bonus_amount))}
                                  </span>
                                </div>
                                <div className="grid grid-cols-6 gap-1 pt-2">
                                  {MONTH_LABELS.map((m, i) => (
                                    <div key={i} className="text-center">
                                      <div className="text-[10px] text-muted-foreground">{m}</div>
                                      <div className="text-xs font-medium">
                                        {g.monthly_targets[String(i)] ?? 0}{unit}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="apuracao" className="mt-4">
                    <ConsultantPayoutTable
                      goals={consultantGoals}
                      userId={c.id}
                      year={year}
                      products={products}
                    />
                  </TabsContent>
                </Tabs>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
        </TabsContent>

        <TabsContent value="incentive">
          <CsIncentivePlanSection />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Editar meta" : "Nova meta"} —{" "}
              {consultants.find((c: any) => c.id === editing?.user_id)?.name}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Produto</Label>
                  <Select
                    value={editing.product_id}
                    onValueChange={(v) => setEditing({ ...editing, product_id: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Métrica</Label>
                  <Select
                    value={editing.metric_type}
                    onValueChange={(v) => setEditing({ ...editing, metric_type: v as MetricType })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(METRIC_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Meta anual {editing.metric_type === "nps" ? "(score)" : "(%)"}</Label>
                  <Input
                    type="number"
                    value={editing.annual_target}
                    onChange={(e) => setEditing({ ...editing, annual_target: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Bônus / gatilho (R$)</Label>
                  <Input
                    type="number"
                    value={editing.bonus_amount}
                    onChange={(e) => setEditing({ ...editing, bonus_amount: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label>Metas mensais</Label>
                <div className="grid grid-cols-6 gap-2 mt-2">
                  {MONTH_LABELS.map((m, i) => (
                    <div key={i}>
                      <div className="text-xs text-muted-foreground mb-1">{m}</div>
                      <Input
                        type="number"
                        value={editing.monthly_targets[String(i)] ?? ""}
                        onChange={(e) => updateMonthly(i, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="Critérios, regras de pagamento, etc."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsertGoal.isPending}>
              {upsertGoal.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
