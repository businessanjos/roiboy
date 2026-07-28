import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSalesGoals,
  type SalesGoal,
  type SalesGoalInput,
  type SalesGoalPeriodType,
  type SalesGoalTargetType,
} from "@/hooks/useSalesGoals";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal?: SalesGoal | null;
}

function currentPeriod(type: SalesGoalPeriodType) {
  const now = new Date();
  const start = type === "weekly" ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
  const end = type === "weekly" ? endOfWeek(now, { weekStartsOn: 1 }) : endOfMonth(now);
  return {
    period_start: format(start, "yyyy-MM-dd"),
    period_end: format(end, "yyyy-MM-dd"),
  };
}

export function SalesGoalDialog({ open, onOpenChange, goal }: Props) {
  const { currentUser } = useCurrentUser();
  const { create, update } = useSalesGoals();

  const { data: users = [] } = useQuery({
    queryKey: ["users-for-goals", currentUser?.account_id],
    enabled: !!currentUser?.account_id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, is_active")
        .eq("account_id", currentUser!.account_id)
        .neq("is_active", false)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const initial = useMemo<SalesGoalInput>(() => {
    if (goal) {
      return {
        user_id: goal.user_id,
        period_type: goal.period_type,
        period_start: goal.period_start,
        period_end: goal.period_end,
        target_type: goal.target_type,
        target_value: Number(goal.target_value),
        note: goal.note ?? "",
      };
    }
    const p = currentPeriod("monthly");
    return {
      user_id: "",
      period_type: "monthly",
      period_start: p.period_start,
      period_end: p.period_end,
      target_type: "revenue",
      target_value: 0,
      note: "",
    };
  }, [goal]);

  const [form, setForm] = useState<SalesGoalInput>(initial);
  useEffect(() => setForm(initial), [initial]);

  const patch = <K extends keyof SalesGoalInput>(k: K, v: SalesGoalInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setPeriodType = (t: SalesGoalPeriodType) => {
    const p = currentPeriod(t);
    setForm((f) => ({ ...f, period_type: t, period_start: p.period_start, period_end: p.period_end }));
  };

  const submit = async () => {
    if (!form.user_id) return;
    if (goal) await update.mutateAsync({ id: goal.id, ...form });
    else await create.mutateAsync(form);
    onOpenChange(false);
  };

  const busy = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : "Nova meta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Vendedor</Label>
            <Select value={form.user_id} onValueChange={(v) => patch("user_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o vendedor" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Período</Label>
              <Select
                value={form.period_type}
                onValueChange={(v) => setPeriodType(v as SalesGoalPeriodType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo de meta</Label>
              <Select
                value={form.target_type}
                onValueChange={(v) => patch("target_type", v as SalesGoalTargetType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Receita ganha (R$)</SelectItem>
                  <SelectItem value="count">Nº de negócios ganhos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Início</Label>
              <Input
                type="date"
                value={form.period_start}
                onChange={(e) => patch("period_start", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Fim</Label>
              <Input
                type="date"
                value={form.period_end}
                onChange={(e) => patch("period_end", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Valor-alvo {form.target_type === "revenue" ? "(R$)" : "(quantidade)"}</Label>
            <Input
              type="number"
              min={0}
              step={form.target_type === "revenue" ? "0.01" : "1"}
              value={form.target_value}
              onChange={(e) => patch("target_value", Number(e.target.value))}
            />
          </div>

          <div className="space-y-1">
            <Label>Observação (opcional)</Label>
            <Input
              value={form.note ?? ""}
              onChange={(e) => patch("note", e.target.value)}
              placeholder="Ex: campanha de fim de mês"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy || !form.user_id || form.target_value <= 0}>
            {goal ? "Salvar" : "Criar meta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
