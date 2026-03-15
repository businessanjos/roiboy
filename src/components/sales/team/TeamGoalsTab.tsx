import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Save, Target, ChevronLeft, ChevronRight, Users,
  Phone, CalendarCheck, UserPlus, DollarSign, Handshake,
  Plus, Trash2, Settings2, BarChart3, Hash,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

const SALES_TEAM_NAMES = ["vanessa", "darlan", "george"];

interface MetricConfig {
  id?: string;
  metric_key: string;
  metric_label: string;
  metric_unit: string;
  default_value: number;
  is_currency: boolean;
  icon_name: string;
  display_order: number;
}

// Default metrics seeded per cargo when none exist in DB
const SEED_METRICS: Record<string, MetricConfig[]> = {
  SDR: [
    { metric_key: "calls", metric_label: "Ligações", metric_unit: "ligações", default_value: 200, is_currency: false, icon_name: "phone", display_order: 0 },
    { metric_key: "meetings_scheduled", metric_label: "Reuniões Agendadas", metric_unit: "reuniões", default_value: 30, is_currency: false, icon_name: "calendar-check", display_order: 1 },
    { metric_key: "leads_qualified", metric_label: "Leads Qualificados", metric_unit: "leads", default_value: 20, is_currency: false, icon_name: "user-plus", display_order: 2 },
  ],
  BDR: [
    { metric_key: "calls", metric_label: "Ligações", metric_unit: "ligações", default_value: 250, is_currency: false, icon_name: "phone", display_order: 0 },
    { metric_key: "meetings_scheduled", metric_label: "Reuniões Agendadas", metric_unit: "reuniões", default_value: 40, is_currency: false, icon_name: "calendar-check", display_order: 1 },
    { metric_key: "leads_generated", metric_label: "Leads Gerados", metric_unit: "leads", default_value: 50, is_currency: false, icon_name: "user-plus", display_order: 2 },
  ],
  Vendedor: [
    { metric_key: "revenue", metric_label: "Faturamento", metric_unit: "R$", default_value: 450000, is_currency: true, icon_name: "dollar-sign", display_order: 0 },
    { metric_key: "deals_closed", metric_label: "Negócios Fechados", metric_unit: "negócios", default_value: 10, is_currency: false, icon_name: "handshake", display_order: 1 },
    { metric_key: "calls", metric_label: "Ligações", metric_unit: "ligações", default_value: 100, is_currency: false, icon_name: "phone", display_order: 2 },
  ],
  Closer: [
    { metric_key: "revenue", metric_label: "Faturamento", metric_unit: "R$", default_value: 450000, is_currency: true, icon_name: "dollar-sign", display_order: 0 },
    { metric_key: "deals_closed", metric_label: "Negócios Fechados", metric_unit: "negócios", default_value: 15, is_currency: false, icon_name: "handshake", display_order: 1 },
    { metric_key: "meetings_scheduled", metric_label: "Reuniões Realizadas", metric_unit: "reuniões", default_value: 30, is_currency: false, icon_name: "calendar-check", display_order: 2 },
  ],
};

function getMetricIcon(iconName: string) {
  const iconClass = "h-3.5 w-3.5";
  switch (iconName) {
    case "phone": return <Phone className={iconClass} />;
    case "calendar-check": return <CalendarCheck className={iconClass} />;
    case "user-plus": return <UserPlus className={iconClass} />;
    case "dollar-sign": return <DollarSign className={iconClass} />;
    case "handshake": return <Handshake className={iconClass} />;
    case "bar-chart": return <BarChart3 className={iconClass} />;
    case "hash": return <Hash className={iconClass} />;
    default: return <Target className={iconClass} />;
  }
}

const ICON_OPTIONS = [
  { value: "target", label: "Alvo" },
  { value: "phone", label: "Telefone" },
  { value: "calendar-check", label: "Calendário" },
  { value: "user-plus", label: "Lead/Pessoa" },
  { value: "dollar-sign", label: "Financeiro" },
  { value: "handshake", label: "Negócio" },
  { value: "bar-chart", label: "Gráfico" },
  { value: "hash", label: "Número" },
];

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  cargo: string;
}

interface GoalEntry {
  user_id: string;
  year_month: string;
  goal_type: string;
  goal_value: number;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

export function TeamGoalsTab() {
  const { currentUser } = useCurrentUser();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [goals, setGoals] = useState<Record<string, GoalEntry>>({});
  const [metricsByCargo, setMetricsByCargo] = useState<Record<string, MetricConfig[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Metric management dialog
  const [editingCargo, setEditingCargo] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newMetric, setNewMetric] = useState<MetricConfig>({
    metric_key: "",
    metric_label: "",
    metric_unit: "",
    default_value: 0,
    is_currency: false,
    icon_name: "target",
    display_order: 0,
  });

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, "0")}`),
    [selectedYear]
  );

  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    if (!currentUser?.account_id) return;
    loadData();
  }, [currentUser?.account_id, selectedYear]);

  const loadData = async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);

    const [usersRes, careersRes, goalsRes, metricsRes] = await Promise.all([
      supabase.from("users").select("id, name, email, avatar_url")
        .eq("account_id", currentUser.account_id).neq("id", currentUser.id).order("name"),
      supabase.from("sales_team_careers").select("user_id, cargo")
        .eq("account_id", currentUser.account_id),
      supabase.from("sales_monthly_goals").select("*")
        .eq("account_id", currentUser.account_id).like("year_month", `${selectedYear}-%`),
      supabase.from("sales_goal_metrics").select("*")
        .eq("account_id", currentUser.account_id).order("display_order"),
    ]);

    // Cargo map
    const cargoMap: Record<string, string> = {};
    if (careersRes.data) {
      for (const c of careersRes.data) cargoMap[c.user_id] = (c as any).cargo || "Vendedor";
    }

    // Members
    if (usersRes.data) {
      const filtered = (usersRes.data as any[])
        .filter((u) => SALES_TEAM_NAMES.some((name) => u.name.toLowerCase().includes(name)))
        .map((u) => ({ ...u, cargo: cargoMap[u.id] || "Vendedor" })) as TeamMember[];
      setMembers(filtered);
    }

    // Goals
    if (goalsRes.data) {
      const map: Record<string, GoalEntry> = {};
      for (const g of goalsRes.data) {
        const gt = (g as any).goal_type || "revenue";
        map[`${g.user_id}_${g.year_month}_${gt}`] = {
          user_id: g.user_id, year_month: g.year_month, goal_type: gt, goal_value: g.goal_value,
        };
      }
      setGoals(map);
    }

    // Metrics - build by cargo, use DB data or seed defaults
    const dbMetrics: Record<string, MetricConfig[]> = {};
    if (metricsRes.data && metricsRes.data.length > 0) {
      for (const m of metricsRes.data) {
        const cargo = (m as any).cargo;
        if (!dbMetrics[cargo]) dbMetrics[cargo] = [];
        dbMetrics[cargo].push({
          id: m.id,
          metric_key: m.metric_key,
          metric_label: m.metric_label,
          metric_unit: m.metric_unit,
          default_value: m.default_value,
          is_currency: m.is_currency,
          icon_name: m.icon_name,
          display_order: m.display_order,
        });
      }
    }

    // For each cargo present in members, ensure we have metrics (seed if needed)
    const activeCargos = new Set(Object.values(cargoMap));
    const finalMetrics: Record<string, MetricConfig[]> = {};

    for (const cargo of activeCargos) {
      if (dbMetrics[cargo] && dbMetrics[cargo].length > 0) {
        finalMetrics[cargo] = dbMetrics[cargo];
      } else {
        // Seed defaults
        const seeds = SEED_METRICS[cargo] || SEED_METRICS["Vendedor"];
        finalMetrics[cargo] = seeds;
        // Persist seeds to DB
        await seedMetricsForCargo(cargo, seeds);
      }
    }

    setMetricsByCargo(finalMetrics);
    setLoading(false);
  };

  const seedMetricsForCargo = async (cargo: string, metrics: MetricConfig[]) => {
    if (!currentUser?.account_id) return;
    const inserts = metrics.map((m, i) => ({
      account_id: currentUser.account_id,
      cargo,
      metric_key: m.metric_key,
      metric_label: m.metric_label,
      metric_unit: m.metric_unit,
      default_value: m.default_value,
      is_currency: m.is_currency,
      icon_name: m.icon_name,
      display_order: i,
    }));
    await supabase.from("sales_goal_metrics").upsert(inserts as any, {
      onConflict: "account_id,cargo,metric_key",
    });
  };

  const getGoalValue = (userId: string, month: string, goalType: string, defaultVal: number) => {
    return goals[`${userId}_${month}_${goalType}`]?.goal_value ?? defaultVal;
  };

  const setGoalValue = (userId: string, month: string, goalType: string, value: number) => {
    const key = `${userId}_${month}_${goalType}`;
    setGoals((prev) => ({
      ...prev,
      [key]: { user_id: userId, year_month: month, goal_type: goalType, goal_value: value },
    }));
  };

  const handleSave = async () => {
    if (!currentUser?.account_id) return;
    setSaving(true);

    const cargoMap: Record<string, string> = {};
    members.forEach((m) => (cargoMap[m.id] = m.cargo));

    const upserts = Object.values(goals).map((g) => ({
      account_id: currentUser.account_id,
      user_id: g.user_id,
      year_month: g.year_month,
      goal_type: g.goal_type,
      goal_value: g.goal_value,
      cargo: cargoMap[g.user_id] || "Vendedor",
      updated_at: new Date().toISOString(),
    }));

    if (upserts.length > 0) {
      const { error } = await supabase
        .from("sales_monthly_goals")
        .upsert(upserts as any, { onConflict: "account_id,user_id,year_month,goal_type" });

      if (error) {
        toast.error("Erro ao salvar metas");
        console.error(error);
      } else {
        toast.success("Metas atualizadas!");
      }
    }
    setSaving(false);
  };

  const handleAddMetric = async () => {
    if (!currentUser?.account_id || !editingCargo) return;
    if (!newMetric.metric_label.trim()) {
      toast.error("Nome da métrica é obrigatório");
      return;
    }

    const key = newMetric.metric_key || newMetric.metric_label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const currentMetrics = metricsByCargo[editingCargo] || [];

    const toInsert = {
      account_id: currentUser.account_id,
      cargo: editingCargo,
      metric_key: key,
      metric_label: newMetric.metric_label,
      metric_unit: newMetric.metric_unit || newMetric.metric_label.toLowerCase(),
      default_value: newMetric.default_value,
      is_currency: newMetric.is_currency,
      icon_name: newMetric.icon_name,
      display_order: currentMetrics.length,
    };

    const { error, data } = await supabase
      .from("sales_goal_metrics")
      .insert(toInsert as any)
      .select()
      .single();

    if (error) {
      toast.error(error.message.includes("duplicate") ? "Métrica já existe para este cargo" : "Erro ao adicionar métrica");
      return;
    }

    setMetricsByCargo((prev) => ({
      ...prev,
      [editingCargo]: [
        ...(prev[editingCargo] || []),
        { ...toInsert, id: (data as any).id } as MetricConfig,
      ],
    }));

    setNewMetric({
      metric_key: "", metric_label: "", metric_unit: "",
      default_value: 0, is_currency: false, icon_name: "target", display_order: 0,
    });
    setAddDialogOpen(false);
    toast.success(`Métrica "${newMetric.metric_label}" adicionada ao cargo ${editingCargo}`);
  };

  const handleDeleteMetric = async (cargo: string, metric: MetricConfig) => {
    if (!metric.id) return;

    const { error } = await supabase
      .from("sales_goal_metrics")
      .delete()
      .eq("id", metric.id);

    if (error) {
      toast.error("Erro ao remover métrica");
      return;
    }

    setMetricsByCargo((prev) => ({
      ...prev,
      [cargo]: (prev[cargo] || []).filter((m) => m.metric_key !== metric.metric_key),
    }));
    toast.success(`Métrica "${metric.metric_label}" removida`);
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const membersByCargo = useMemo(() => {
    const groups: Record<string, TeamMember[]> = {};
    for (const m of members) {
      if (!groups[m.cargo]) groups[m.cargo] = [];
      groups[m.cargo].push(m);
    }
    return groups;
  }, [members]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded-lg w-48" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Metas Mensais por Cargo</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedYear((y) => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium text-sm w-12 text-center">{selectedYear}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedYear((y) => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum membro da equipe encontrado.</p>
            <p className="text-xs mt-1">Defina o cargo de cada membro na aba Carreira primeiro.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(membersByCargo).map(([cargo, cargoMembers]) => {
          const goalTypes = metricsByCargo[cargo] || [];

          return (
            <Card key={cargo}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">{cargo}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">
                      {cargoMembers.length} {cargoMembers.length === 1 ? "pessoa" : "pessoas"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1"
                      onClick={() => { setEditingCargo(cargo); setAddDialogOpen(true); }}
                    >
                      <Plus className="h-3 w-3" />
                      Métrica
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] gap-1"
                      onClick={() => setEditingCargo(editingCargo === cargo ? null : cargo)}
                    >
                      <Settings2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Metric badges with delete when editing */}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {goalTypes.map((gt) => (
                    <Badge
                      key={gt.metric_key}
                      variant="outline"
                      className={`text-[10px] gap-1 font-normal ${editingCargo === cargo ? "pr-1" : ""}`}
                    >
                      {getMetricIcon(gt.icon_name)} {gt.metric_label}
                      {editingCargo === cargo && (
                        <button
                          onClick={() => handleDeleteMetric(cargo, gt)}
                          className="ml-1 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </Badge>
                  ))}
                  {goalTypes.length === 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Nenhuma métrica configurada. Clique em "+ Métrica" para adicionar.
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {cargoMembers.map((member) => (
                  <div key={member.id} className="border-t">
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted/30">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[9px]">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-xs">{member.name}</span>
                    </div>

                    {goalTypes.map((gt) => (
                      <div key={gt.metric_key} className="border-t border-dashed">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr>
                                <th className="text-left p-2 pl-4 font-medium sticky left-0 bg-background z-10 min-w-[150px]">
                                  <span className="flex items-center gap-1.5 text-muted-foreground">
                                    {getMetricIcon(gt.icon_name)} {gt.metric_label}
                                  </span>
                                </th>
                                {months.map((m) => {
                                  const monthIdx = parseInt(m.split("-")[1]) - 1;
                                  const isCurrent = m === currentMonth;
                                  return (
                                    <th key={m} className={`text-center p-1 font-normal min-w-[80px] ${isCurrent ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}>
                                      {MONTH_NAMES[monthIdx]}
                                    </th>
                                  );
                                })}
                                <th className="text-center p-1 font-medium min-w-[90px] bg-muted/50">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="p-2 pl-4 sticky left-0 bg-background z-10" />
                                {months.map((m) => {
                                  const isCurrent = m === currentMonth;
                                  const value = getGoalValue(member.id, m, gt.metric_key, gt.default_value);
                                  return (
                                    <td key={m} className={`p-1 ${isCurrent ? "bg-primary/5" : ""}`}>
                                      <Input
                                        type="number"
                                        value={value || ""}
                                        onChange={(e) =>
                                          setGoalValue(member.id, m, gt.metric_key, e.target.value === "" ? 0 : Number(e.target.value))
                                        }
                                        className="h-7 text-xs text-center w-full"
                                      />
                                    </td>
                                  );
                                })}
                                <td className="p-1 text-center bg-muted/30">
                                  <span className="text-xs font-semibold">
                                    {gt.is_currency
                                      ? formatCurrency(months.reduce((s, m) => s + getGoalValue(member.id, m, gt.metric_key, gt.default_value), 0))
                                      : formatNumber(months.reduce((s, m) => s + getGoalValue(member.id, m, gt.metric_key, gt.default_value), 0))}
                                  </span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Add Metric Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Nova Métrica — {editingCargo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da métrica *</Label>
              <Input
                value={newMetric.metric_label}
                onChange={(e) => setNewMetric((p) => ({ ...p, metric_label: e.target.value }))}
                placeholder="Ex: Propostas Enviadas"
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Unidade</Label>
                <Input
                  value={newMetric.metric_unit}
                  onChange={(e) => setNewMetric((p) => ({ ...p, metric_unit: e.target.value }))}
                  placeholder="Ex: propostas"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor padrão mensal</Label>
                <Input
                  type="number"
                  value={newMetric.default_value || ""}
                  onChange={(e) => setNewMetric((p) => ({ ...p, default_value: Number(e.target.value) }))}
                  placeholder="0"
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ícone</Label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={newMetric.icon_name === opt.value ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-[10px] gap-1"
                    onClick={() => setNewMetric((p) => ({ ...p, icon_name: opt.value }))}
                  >
                    {getMetricIcon(opt.value)} {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newMetric.is_currency}
                onCheckedChange={(v) => setNewMetric((p) => ({ ...p, is_currency: v }))}
              />
              <Label className="text-xs">Valor monetário (R$)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAddMetric}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
