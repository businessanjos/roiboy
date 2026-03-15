import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, Target, ChevronLeft, ChevronRight, Users, Phone, CalendarCheck, UserPlus, DollarSign, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

const SALES_TEAM_NAMES = ["vanessa", "darlan", "george"];

// Goal types per cargo
interface GoalTypeConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  unit: string;
  defaultValue: number;
  isCurrency: boolean;
}

const GOAL_TYPES_BY_CARGO: Record<string, GoalTypeConfig[]> = {
  SDR: [
    { key: "calls", label: "Ligações", icon: <Phone className="h-3.5 w-3.5" />, unit: "ligações", defaultValue: 200, isCurrency: false },
    { key: "meetings_scheduled", label: "Reuniões Agendadas", icon: <CalendarCheck className="h-3.5 w-3.5" />, unit: "reuniões", defaultValue: 30, isCurrency: false },
    { key: "leads_qualified", label: "Leads Qualificados", icon: <UserPlus className="h-3.5 w-3.5" />, unit: "leads", defaultValue: 20, isCurrency: false },
  ],
  BDR: [
    { key: "calls", label: "Ligações", icon: <Phone className="h-3.5 w-3.5" />, unit: "ligações", defaultValue: 250, isCurrency: false },
    { key: "meetings_scheduled", label: "Reuniões Agendadas", icon: <CalendarCheck className="h-3.5 w-3.5" />, unit: "reuniões", defaultValue: 40, isCurrency: false },
    { key: "leads_generated", label: "Leads Gerados", icon: <UserPlus className="h-3.5 w-3.5" />, unit: "leads", defaultValue: 50, isCurrency: false },
  ],
  Vendedor: [
    { key: "revenue", label: "Faturamento", icon: <DollarSign className="h-3.5 w-3.5" />, unit: "R$", defaultValue: 450000, isCurrency: true },
    { key: "deals_closed", label: "Negócios Fechados", icon: <Handshake className="h-3.5 w-3.5" />, unit: "negócios", defaultValue: 10, isCurrency: false },
    { key: "calls", label: "Ligações", icon: <Phone className="h-3.5 w-3.5" />, unit: "ligações", defaultValue: 100, isCurrency: false },
  ],
  Closer: [
    { key: "revenue", label: "Faturamento", icon: <DollarSign className="h-3.5 w-3.5" />, unit: "R$", defaultValue: 450000, isCurrency: true },
    { key: "deals_closed", label: "Negócios Fechados", icon: <Handshake className="h-3.5 w-3.5" />, unit: "negócios", defaultValue: 15, isCurrency: false },
    { key: "meetings_scheduled", label: "Reuniões Realizadas", icon: <CalendarCheck className="h-3.5 w-3.5" />, unit: "reuniões", defaultValue: 30, isCurrency: false },
  ],
};

// Fallback for unknown cargos
const DEFAULT_GOAL_TYPES: GoalTypeConfig[] = GOAL_TYPES_BY_CARGO["Vendedor"];

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

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

export function TeamGoalsTab() {
  const { currentUser } = useCurrentUser();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [goals, setGoals] = useState<Record<string, GoalEntry>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, "0");
        return `${selectedYear}-${m}`;
      }),
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

    const [usersRes, careersRes, goalsRes] = await Promise.all([
      supabase
        .from("users")
        .select("id, name, email, avatar_url")
        .eq("account_id", currentUser.account_id)
        .neq("id", currentUser.id)
        .order("name"),
      supabase
        .from("sales_team_careers")
        .select("user_id, cargo")
        .eq("account_id", currentUser.account_id),
      supabase
        .from("sales_monthly_goals")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .like("year_month", `${selectedYear}-%`),
    ]);

    const cargoMap: Record<string, string> = {};
    if (careersRes.data) {
      for (const c of careersRes.data) {
        cargoMap[c.user_id] = (c as any).cargo || "Vendedor";
      }
    }

    if (usersRes.data) {
      const filtered = (usersRes.data as any[])
        .filter((u) =>
          SALES_TEAM_NAMES.some((name) => u.name.toLowerCase().includes(name))
        )
        .map((u) => ({
          ...u,
          cargo: cargoMap[u.id] || "Vendedor",
        })) as TeamMember[];
      setMembers(filtered);
    }

    if (goalsRes.data) {
      const map: Record<string, GoalEntry> = {};
      for (const g of goalsRes.data) {
        const gt = (g as any).goal_type || "revenue";
        map[`${g.user_id}_${g.year_month}_${gt}`] = {
          user_id: g.user_id,
          year_month: g.year_month,
          goal_type: gt,
          goal_value: g.goal_value,
        };
      }
      setGoals(map);
    }

    setLoading(false);
  };

  const getGoalValue = (userId: string, month: string, goalType: string, defaultVal: number) => {
    const key = `${userId}_${month}_${goalType}`;
    return goals[key]?.goal_value ?? defaultVal;
  };

  const setGoalValue = (userId: string, month: string, goalType: string, value: number) => {
    const key = `${userId}_${month}_${goalType}`;
    setGoals((prev) => ({
      ...prev,
      [key]: {
        user_id: userId,
        year_month: month,
        goal_type: goalType,
        goal_value: value,
      },
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

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  // Group members by cargo
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
      {/* Year navigation */}
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
          const goalTypes = GOAL_TYPES_BY_CARGO[cargo] || DEFAULT_GOAL_TYPES;

          return (
            <Card key={cargo}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">{cargo}</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    {cargoMembers.length} {cargoMembers.length === 1 ? "pessoa" : "pessoas"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {goalTypes.map((gt) => (
                    <Badge key={gt.key} variant="outline" className="text-[10px] gap-1 font-normal">
                      {gt.icon} {gt.label}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {cargoMembers.map((member) => (
                  <div key={member.id} className="border-t">
                    {/* Member header */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted/30">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[9px]">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-xs">{member.name}</span>
                    </div>

                    {/* Goals table per goal type */}
                    {goalTypes.map((gt) => (
                      <div key={gt.key} className="border-t border-dashed">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr>
                                <th className="text-left p-2 pl-4 font-medium sticky left-0 bg-background z-10 min-w-[150px]">
                                  <span className="flex items-center gap-1.5 text-muted-foreground">
                                    {gt.icon} {gt.label}
                                  </span>
                                </th>
                                {months.map((m) => {
                                  const monthIdx = parseInt(m.split("-")[1]) - 1;
                                  const isCurrent = m === currentMonth;
                                  return (
                                    <th
                                      key={m}
                                      className={`text-center p-1 font-normal min-w-[80px] ${
                                        isCurrent ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                                      }`}
                                    >
                                      {MONTH_NAMES[monthIdx]}
                                    </th>
                                  );
                                })}
                                <th className="text-center p-1 font-medium min-w-[90px] bg-muted/50">
                                  Total
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="p-2 pl-4 sticky left-0 bg-background z-10" />
                                {months.map((m) => {
                                  const isCurrent = m === currentMonth;
                                  const value = getGoalValue(member.id, m, gt.key, gt.defaultValue);
                                  return (
                                    <td key={m} className={`p-1 ${isCurrent ? "bg-primary/5" : ""}`}>
                                      <Input
                                        type="number"
                                        value={value || ""}
                                        onChange={(e) =>
                                          setGoalValue(
                                            member.id,
                                            m,
                                            gt.key,
                                            e.target.value === "" ? 0 : Number(e.target.value)
                                          )
                                        }
                                        className="h-7 text-xs text-center w-full"
                                      />
                                    </td>
                                  );
                                })}
                                <td className="p-1 text-center bg-muted/30">
                                  <span className="text-xs font-semibold">
                                    {gt.isCurrency
                                      ? formatCurrency(
                                          months.reduce((s, m) => s + getGoalValue(member.id, m, gt.key, gt.defaultValue), 0)
                                        )
                                      : formatNumber(
                                          months.reduce((s, m) => s + getGoalValue(member.id, m, gt.key, gt.defaultValue), 0)
                                        )}
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
    </div>
  );
}
