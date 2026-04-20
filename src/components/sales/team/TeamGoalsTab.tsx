import { useState, useEffect, useMemo, useCallback } from "react";
import { CompanyGoalCard } from "./CompanyGoalCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Save, Target, ChevronLeft, ChevronRight, Users,
  Phone, CalendarCheck, UserPlus, DollarSign, Handshake,
  Plus, Trash2, Settings2, BarChart3, Hash, TrendingUp,
  Calculator, UserCog, Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";


const SALES_TEAM_NAMES = ["everton", "jonathan", "maikol", "darlan", "vanessa", "george"];

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

function getMetricIcon(iconName: string, className = "h-4 w-4") {
  switch (iconName) {
    case "phone": return <Phone className={className} />;
    case "calendar-check": return <CalendarCheck className={className} />;
    case "user-plus": return <UserPlus className={className} />;
    case "dollar-sign": return <DollarSign className={className} />;
    case "handshake": return <Handshake className={className} />;
    case "bar-chart": return <BarChart3 className={className} />;
    case "hash": return <Hash className={className} />;
    default: return <Target className={className} />;
  }
}

const ICON_OPTIONS = [
  { value: "target", label: "Alvo" },
  { value: "phone", label: "Telefone" },
  { value: "calendar-check", label: "Calendário" },
  { value: "user-plus", label: "Lead" },
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
  super_goal_value: number;
}

const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTH_NAMES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

const formatInputDisplay = (value: number) =>
  value ? value.toLocaleString("pt-BR") : "";

const parseInputNumber = (str: string): number => {
  const digits = str.replace(/\D/g, "");
  return Number(digits) || 0;
};

export function TeamGoalsTab() {
  const { currentUser } = useCurrentUser();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [goals, setGoals] = useState<Record<string, GoalEntry>>({});
  const [metricsByCargo, setMetricsByCargo] = useState<Record<string, MetricConfig[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"individual" | "bulk">("individual");

  const [editingCargo, setEditingCargo] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [manageMetricsOpen, setManageMetricsOpen] = useState(false);
  const [annualDialogOpen, setAnnualDialogOpen] = useState(false);
  const [annualMetricKey, setAnnualMetricKey] = useState("");
  const [annualValue, setAnnualValue] = useState(0);
  const [annualTargetUserId, setAnnualTargetUserId] = useState("");

  const [newMetric, setNewMetric] = useState<MetricConfig>({
    metric_key: "", metric_label: "", metric_unit: "",
    default_value: 0, is_currency: false, icon_name: "target", display_order: 0,
  });

  // Bulk mode state
  const [bulkCargo, setBulkCargo] = useState<string>("");
  const [bulkAnnualValues, setBulkAnnualValues] = useState<Record<string, number>>({});

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const currentYearMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  useEffect(() => {
    if (!currentUser?.account_id) return;
    loadData();
  }, [currentUser?.account_id, selectedYear]);

  useEffect(() => {
    if (members.length > 0 && !selectedMember) {
      setSelectedMember(members[0].id);
    }
  }, [members]);

  const loadData = async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);

    const [usersRes, careersRes, goalsRes, metricsRes] = await Promise.all([
      supabase.from("users").select("id, name, email, avatar_url")
        .eq("account_id", currentUser.account_id).order("name"),
      supabase.from("sales_team_careers").select("user_id, cargo")
        .eq("account_id", currentUser.account_id),
      supabase.from("sales_monthly_goals").select("*")
        .eq("account_id", currentUser.account_id).like("year_month", `${selectedYear}-%`),
      supabase.from("sales_goal_metrics").select("*")
        .eq("account_id", currentUser.account_id).order("display_order"),
    ]);

    const cargoMap: Record<string, string> = {};
    if (careersRes.data) {
      for (const c of careersRes.data) cargoMap[c.user_id] = (c as any).cargo || "Vendedor";
    }

    if (usersRes.data) {
      const filtered = (usersRes.data as any[])
        .filter((u) => SALES_TEAM_NAMES.some((name) => u.name.toLowerCase().includes(name)))
        .map((u) => ({ ...u, cargo: cargoMap[u.id] || "Vendedor" })) as TeamMember[];
      // Sort by SALES_TEAM_NAMES order
      filtered.sort((a, b) => {
        const idxA = SALES_TEAM_NAMES.findIndex((n) => a.name.toLowerCase().includes(n));
        const idxB = SALES_TEAM_NAMES.findIndex((n) => b.name.toLowerCase().includes(n));
        return idxA - idxB;
      });
      setMembers(filtered);
    }

    if (goalsRes.data) {
      const map: Record<string, GoalEntry> = {};
      for (const g of goalsRes.data) {
        const gt = (g as any).goal_type || "revenue";
        map[`${g.user_id}_${g.year_month}_${gt}`] = {
          user_id: g.user_id, year_month: g.year_month, goal_type: gt, goal_value: g.goal_value,
          super_goal_value: (g as any).super_goal_value ?? 0,
        };
      }
      setGoals(map);
    }

    const dbMetrics: Record<string, MetricConfig[]> = {};
    if (metricsRes.data && metricsRes.data.length > 0) {
      for (const m of metricsRes.data) {
        const cargo = (m as any).cargo;
        if (!dbMetrics[cargo]) dbMetrics[cargo] = [];
        dbMetrics[cargo].push({
          id: m.id, metric_key: m.metric_key, metric_label: m.metric_label,
          metric_unit: m.metric_unit, default_value: m.default_value,
          is_currency: m.is_currency, icon_name: m.icon_name, display_order: m.display_order,
        });
      }
    }

    const activeCargos = new Set(Object.values(cargoMap));
    const finalMetrics: Record<string, MetricConfig[]> = {};
    for (const cargo of activeCargos) {
      if (dbMetrics[cargo] && dbMetrics[cargo].length > 0) {
        finalMetrics[cargo] = dbMetrics[cargo];
      } else {
        const seeds = SEED_METRICS[cargo] || SEED_METRICS["Vendedor"];
        finalMetrics[cargo] = seeds;
        await seedMetricsForCargo(cargo, seeds);
      }
    }
    setMetricsByCargo(finalMetrics);
    if (!bulkCargo && Object.keys(finalMetrics).length > 0) {
      setBulkCargo(Object.keys(finalMetrics)[0]);
    }
    setLoading(false);
  };

  const seedMetricsForCargo = async (cargo: string, metrics: MetricConfig[]) => {
    if (!currentUser?.account_id) return;
    const inserts = metrics.map((m, i) => ({
      account_id: currentUser.account_id, cargo,
      metric_key: m.metric_key, metric_label: m.metric_label, metric_unit: m.metric_unit,
      default_value: m.default_value, is_currency: m.is_currency,
      icon_name: m.icon_name, display_order: i,
    }));
    await supabase.from("sales_goal_metrics").upsert(inserts as any, {
      onConflict: "account_id,cargo,metric_key",
    });
  };

  const getGoalValue = (userId: string, month: string, goalType: string, defaultVal: number) => {
    return goals[`${userId}_${month}_${goalType}`]?.goal_value ?? defaultVal;
  };

  const getSuperGoalValue = (userId: string, month: string, goalType: string) => {
    return goals[`${userId}_${month}_${goalType}`]?.super_goal_value ?? 0;
  };

  const setGoalValue = (userId: string, month: string, goalType: string, value: number) => {
    const key = `${userId}_${month}_${goalType}`;
    setGoals((prev) => ({
      ...prev,
      [key]: { ...prev[key], user_id: userId, year_month: month, goal_type: goalType, goal_value: value, super_goal_value: prev[key]?.super_goal_value ?? 0 },
    }));
  };

  const setSuperGoalValue = (userId: string, month: string, goalType: string, value: number) => {
    const key = `${userId}_${month}_${goalType}`;
    setGoals((prev) => ({
      ...prev,
      [key]: { ...prev[key], user_id: userId, year_month: month, goal_type: goalType, super_goal_value: value, goal_value: prev[key]?.goal_value ?? 0 },
    }));
  };

  const handleSave = async () => {
    if (!currentUser?.account_id) return;
    setSaving(true);
    const cargoMap: Record<string, string> = {};
    members.forEach((m) => (cargoMap[m.id] = m.cargo));

    const upserts = Object.values(goals).map((g) => ({
      account_id: currentUser.account_id, user_id: g.user_id,
      year_month: g.year_month, goal_type: g.goal_type, goal_value: g.goal_value,
      super_goal_value: g.super_goal_value ?? 0,
      cargo: cargoMap[g.user_id] || "Vendedor", updated_at: new Date().toISOString(),
    }));

    if (upserts.length === 0) {
      toast.info("Nenhuma meta foi alterada.");
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("sales_monthly_goals")
      .upsert(upserts as any, { onConflict: "account_id,user_id,year_month,goal_type" });
    if (error) {
      toast.error("Erro ao salvar metas");
    } else {
      toast.success("Metas atualizadas!");
    }
    setSaving(false);
  };

  // Distribute annual goal equally across 12 months
  const handleDistributeAnnual = (userId: string, metricKey: string, annualTotal: number) => {
    const monthlyValue = Math.round(annualTotal / 12);
    const remainder = annualTotal - monthlyValue * 12;
    for (let i = 0; i < 12; i++) {
      const ym = `${selectedYear}-${String(i + 1).padStart(2, "0")}`;
      // Put remainder in the last month
      const val = i === 11 ? monthlyValue + remainder : monthlyValue;
      setGoalValue(userId, ym, metricKey, val);
    }
    toast.success(`Meta anual de ${formatNumber(annualTotal)} distribuída em 12 meses`);
  };

  // Bulk: apply the same annual goal to all members of a cargo
  const handleBulkApply = (cargo: string) => {
    const cargoMembers = members.filter((m) => m.cargo === cargo);
    const metrics = metricsByCargo[cargo] || [];
    let applied = 0;

    for (const metric of metrics) {
      const annualVal = bulkAnnualValues[`${cargo}_${metric.metric_key}`];
      if (annualVal && annualVal > 0) {
        for (const member of cargoMembers) {
          handleDistributeAnnual(member.id, metric.metric_key, annualVal);
          applied++;
        }
      }
    }

    if (applied > 0) {
      toast.success(`Metas aplicadas a ${cargoMembers.length} membro(s) do cargo ${cargo}`);
    } else {
      toast.error("Preencha ao menos uma meta anual");
    }
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
      account_id: currentUser.account_id, cargo: editingCargo, metric_key: key,
      metric_label: newMetric.metric_label,
      metric_unit: newMetric.metric_unit || newMetric.metric_label.toLowerCase(),
      default_value: newMetric.default_value, is_currency: newMetric.is_currency,
      icon_name: newMetric.icon_name, display_order: currentMetrics.length,
    };
    const { error, data } = await supabase.from("sales_goal_metrics").insert(toInsert as any).select().single();
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Métrica já existe" : "Erro ao adicionar");
      return;
    }
    setMetricsByCargo((prev) => ({
      ...prev,
      [editingCargo]: [...(prev[editingCargo] || []), { ...toInsert, id: (data as any).id } as MetricConfig],
    }));
    setNewMetric({ metric_key: "", metric_label: "", metric_unit: "", default_value: 0, is_currency: false, icon_name: "target", display_order: 0 });
    setAddDialogOpen(false);
    toast.success(`Métrica "${newMetric.metric_label}" adicionada`);
  };

  const handleDeleteMetric = async (cargo: string, metric: MetricConfig) => {
    if (!metric.id) return;
    const { error } = await supabase.from("sales_goal_metrics").delete().eq("id", metric.id);
    if (error) { toast.error("Erro ao remover"); return; }
    setMetricsByCargo((prev) => ({
      ...prev,
      [cargo]: (prev[cargo] || []).filter((m) => m.metric_key !== metric.metric_key),
    }));
    toast.success(`"${metric.metric_label}" removida`);
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const activeMember = members.find((m) => m.id === selectedMember);
  const activeMetrics = activeMember ? (metricsByCargo[activeMember.cargo] || []) : [];

  const getYearTotal = (userId: string, metricKey: string, defaultVal: number) => {
    let total = 0;
    for (let i = 0; i < 12; i++) {
      const ym = `${selectedYear}-${String(i + 1).padStart(2, "0")}`;
      total += getGoalValue(userId, ym, metricKey, defaultVal);
    }
    return total;
  };

  const navigateMonth = (dir: -1 | 1) => {
    let newMonth = selectedMonth + dir;
    let newYear = selectedYear;
    if (newMonth < 0) { newMonth = 11; newYear--; setSelectedYear(newYear); }
    else if (newMonth > 11) { newMonth = 0; newYear++; setSelectedYear(newYear); }
    setSelectedMonth(newMonth);
  };

  const uniqueCargos = useMemo(() => {
    return [...new Set(members.map((m) => m.cargo))];
  }, [members]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted/50 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhum membro encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">Defina o cargo na aba Carreira primeiro.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Company Goal Card */}
      <CompanyGoalCard />
      {/* Annual Goal Dialog */}
      <Dialog open={annualDialogOpen} onOpenChange={setAnnualDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              Meta Anual {selectedYear}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe o total anual e o sistema dividirá igualmente pelos 12 meses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Total anual</Label>
              <Input
                type="number"
                value={annualValue || ""}
                onChange={(e) => setAnnualValue(e.target.value === "" ? 0 : Number(e.target.value))}
                className="h-11 text-lg font-semibold"
                placeholder="0"
                autoFocus
              />
            </div>
            {annualValue > 0 && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <div className="text-[10px] text-muted-foreground">Valor mensal estimado</div>
                <div className="text-lg font-bold text-foreground">
                  {formatNumber(Math.round(annualValue / 12))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAnnualDialogOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              className="gap-1"
              onClick={() => {
                handleDistributeAnnual(annualTargetUserId, annualMetricKey, annualValue);
                setAnnualDialogOpen(false);
              }}
            >
              <Calculator className="h-3.5 w-3.5" /> Distribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Metric Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Nova Métrica
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adicionar ao cargo: <span className="font-medium text-foreground">{editingCargo}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome da métrica</Label>
              <Input
                value={newMetric.metric_label}
                onChange={(e) => setNewMetric((p) => ({ ...p, metric_label: e.target.value }))}
                placeholder="Ex: Propostas Enviadas"
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Unidade</Label>
                <Input
                  value={newMetric.metric_unit}
                  onChange={(e) => setNewMetric((p) => ({ ...p, metric_unit: e.target.value }))}
                  placeholder="Ex: propostas"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Valor padrão</Label>
                <Input
                  type="number"
                  value={newMetric.default_value || ""}
                  onChange={(e) => setNewMetric((p) => ({ ...p, default_value: Number(e.target.value) }))}
                  placeholder="0"
                  className="h-10"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ícone</Label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={newMetric.icon_name === opt.value ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-[10px] gap-1 rounded-lg"
                    onClick={() => setNewMetric((p) => ({ ...p, icon_name: opt.value }))}
                  >
                    {getMetricIcon(opt.value, "h-3.5 w-3.5")} {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Switch
                checked={newMetric.is_currency}
                onCheckedChange={(v) => setNewMetric((p) => ({ ...p, is_currency: v }))}
              />
              <Label className="text-xs">Valor monetário (R$)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAddMetric} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Metrics Dialog */}
      <Dialog open={manageMetricsOpen} onOpenChange={setManageMetricsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Gerenciar Métricas
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cargo: <span className="font-medium text-foreground">{editingCargo}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            {editingCargo && (metricsByCargo[editingCargo] || []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhuma métrica configurada.</p>
            )}
            {editingCargo && (metricsByCargo[editingCargo] || []).map((metric) => (
              <div
                key={metric.metric_key}
                className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 group transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {getMetricIcon(metric.icon_name, "h-4 w-4")}
                  </div>
                  <div>
                    <div className="text-xs font-medium">{metric.metric_label}</div>
                    <div className="text-[10px] text-muted-foreground">{metric.metric_unit} • Padrão: {metric.is_currency ? formatCurrency(metric.default_value) : formatNumber(metric.default_value)}</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDeleteMetric(editingCargo!, metric)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setManageMetricsOpen(false)}>Fechar</Button>
            <Button size="sm" className="gap-1" onClick={() => { setManageMetricsOpen(false); setAddDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5" /> Nova Métrica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
