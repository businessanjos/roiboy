import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Target, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface MonthlyGoal {
  user_id: string;
  year_month: string;
  goal_value: number;
  notes: string;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value);

export function TeamGoalsTab() {
  const { currentUser } = useCurrentUser();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [goals, setGoals] = useState<Record<string, MonthlyGoal>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Navigation state for year
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // All 12 months for selected year
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, "0");
        return `${selectedYear}-${m}`;
      }),
    [selectedYear]
  );

  useEffect(() => {
    if (!currentUser?.account_id) return;
    loadData();
  }, [currentUser?.account_id, selectedYear]);

  // Sales team filter
  const SALES_TEAM_NAMES = ["vanessa", "darlan", "george"];

  const loadData = async () => {
    if (!currentUser?.account_id) return;
    setLoading(true);

    const [usersRes, goalsRes] = await Promise.all([
      supabase
        .from("users")
        .select("id, name, email, avatar_url")
        .eq("account_id", currentUser.account_id)
        .neq("id", currentUser.id)
        .order("name"),
      supabase
        .from("sales_monthly_goals")
        .select("*")
        .eq("account_id", currentUser.account_id)
        .like("year_month", `${selectedYear}-%`),
    ]);

    if (usersRes.data) {
      const filtered = (usersRes.data as TeamMember[]).filter((u) =>
        SALES_TEAM_NAMES.some((name) => u.name.toLowerCase().includes(name))
      );
      setMembers(filtered);
    }

    if (goalsRes.data) {
      const map: Record<string, MonthlyGoal> = {};
      for (const g of goalsRes.data) {
        map[`${g.user_id}_${g.year_month}`] = {
          user_id: g.user_id,
          year_month: g.year_month,
          goal_value: g.goal_value,
          notes: g.notes || "",
        };
      }
      setGoals(map);
    }

    setLoading(false);
  };

  const getGoalValue = (userId: string, month: string) => {
    return goals[`${userId}_${month}`]?.goal_value ?? 450000;
  };

  const setGoalValue = (userId: string, month: string, value: number) => {
    const key = `${userId}_${month}`;
    setGoals((prev) => ({
      ...prev,
      [key]: {
        user_id: userId,
        year_month: month,
        goal_value: value,
        notes: prev[key]?.notes || "",
      },
    }));
  };

  const handleSave = async () => {
    if (!currentUser?.account_id) return;
    setSaving(true);

    const upserts = Object.values(goals).map((g) => ({
      account_id: currentUser.account_id,
      user_id: g.user_id,
      year_month: g.year_month,
      goal_value: g.goal_value,
      notes: g.notes || null,
      updated_at: new Date().toISOString(),
    }));

    if (upserts.length > 0) {
      const { error } = await supabase
        .from("sales_monthly_goals")
        .upsert(upserts, { onConflict: "account_id,user_id,year_month" });

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
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

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
          <h3 className="font-semibold text-sm">Metas Mensais</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium text-sm w-12 text-center">
            {selectedYear}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSelectedYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum membro da equipe encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium sticky left-0 bg-muted/50 z-10 min-w-[180px]">
                      Vendedor
                    </th>
                    {months.map((m) => {
                      const monthIdx = parseInt(m.split("-")[1]) - 1;
                      const isCurrent = m === currentMonth;
                      return (
                        <th
                          key={m}
                          className={`text-center p-2 font-medium min-w-[120px] ${
                            isCurrent
                              ? "bg-primary/10 text-primary"
                              : ""
                          }`}
                        >
                          <div className="text-xs">
                            {MONTH_NAMES[monthIdx].slice(0, 3)}
                          </div>
                        </th>
                      );
                    })}
                    <th className="text-center p-2 font-medium min-w-[120px] bg-muted/80">
                      <div className="text-xs">Total Ano</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const yearTotal = months.reduce(
                      (sum, m) => sum + getGoalValue(member.id, m),
                      0
                    );
                    return (
                      <tr key={member.id} className="border-b last:border-0">
                        <td className="p-3 sticky left-0 bg-background z-10">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage
                                src={member.avatar_url || undefined}
                              />
                              <AvatarFallback className="text-[10px]">
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-xs truncate max-w-[120px]">
                              {member.name}
                            </span>
                          </div>
                        </td>
                        {months.map((m) => {
                          const isCurrent = m === currentMonth;
                          const value = getGoalValue(member.id, m);
                          return (
                            <td
                              key={m}
                              className={`p-1.5 ${
                                isCurrent ? "bg-primary/5" : ""
                              }`}
                            >
                              <Input
                                type="number"
                                value={value || ""}
                                onChange={(e) =>
                                  setGoalValue(
                                    member.id,
                                    m,
                                    e.target.value === ""
                                      ? 0
                                      : Number(e.target.value)
                                  )
                                }
                                className="h-7 text-xs text-center w-full"
                                placeholder="450000"
                              />
                            </td>
                          );
                        })}
                        <td className="p-2 text-center bg-muted/30">
                          <span className="text-xs font-semibold">
                            {formatCurrency(yearTotal)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {members.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Metas"}
          </Button>
        </div>
      )}
    </div>
  );
}
