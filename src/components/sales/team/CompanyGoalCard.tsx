import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Save, ChevronLeft, ChevronRight, Divide, TrendingUp, Loader2 } from "lucide-react";
import { useCompanyGoals } from "@/hooks/useCompanyGoals";
import { cn } from "@/lib/utils";

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}

function formatNumber(val: number) {
  return val.toLocaleString("pt-BR");
}

function parseInputNumber(str: string): number {
  // Remove everything except digits
  const digits = str.replace(/\D/g, "");
  return Number(digits) || 0;
}

export function CompanyGoalCard() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { goal, isLoading, upsertGoal, MONTH_LABELS } = useCompanyGoals(year);

  const [annualGoal, setAnnualGoal] = useState(0);
  const [monthlyGoals, setMonthlyGoals] = useState<Record<string, number>>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (goal) {
      setAnnualGoal(Number(goal.annual_goal) || 0);
      const mg: Record<string, number> = {};
      MONTHS.forEach((m) => {
        mg[m] = (goal.monthly_goals as any)?.[m] || 0;
      });
      setMonthlyGoals(mg);
    } else {
      setAnnualGoal(0);
      const mg: Record<string, number> = {};
      MONTHS.forEach((m) => { mg[m] = 0; });
      setMonthlyGoals(mg);
    }
    setIsDirty(false);
  }, [goal, year]);

  const monthlySum = Object.values(monthlyGoals).reduce((a, b) => a + b, 0);
  const remaining = annualGoal - monthlySum;

  const distributeEvenly = useCallback(() => {
    if (annualGoal <= 0) return;
    const perMonth = Math.floor(annualGoal / 12);
    const remainder = annualGoal - perMonth * 12;
    const mg: Record<string, number> = {};
    MONTHS.forEach((m, i) => {
      mg[m] = perMonth + (i < remainder ? 1 : 0);
    });
    setMonthlyGoals(mg);
    setIsDirty(true);
  }, [annualGoal]);

  const handleMonthChange = (month: string, value: number) => {
    setMonthlyGoals((prev) => ({ ...prev, [month]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    upsertGoal.mutate({ annual_goal: annualGoal, monthly_goals: monthlyGoals });
    setIsDirty(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" />
            Meta da Empresa
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Annual goal */}
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs font-medium">Meta Anual (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-semibold">R$</span>
              <Input
                type="text"
                value={annualGoal ? formatNumber(annualGoal) : ""}
                onChange={(e) => {
                  setAnnualGoal(parseInputNumber(e.target.value));
                  setIsDirty(true);
                }}
                placeholder="0"
                className="text-lg font-semibold h-10 pl-12"
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-10"
            onClick={distributeEvenly}
            disabled={annualGoal <= 0}
          >
            <Divide className="h-3.5 w-3.5" />
            Dividir Igual
          </Button>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-2 text-xs">
          <Badge variant={remaining === 0 ? "default" : remaining > 0 ? "secondary" : "destructive"} className="text-xs">
            {remaining === 0
              ? "✓ Distribuído"
              : remaining > 0
              ? `Faltam ${formatCurrency(remaining)}`
              : `Excedido em ${formatCurrency(Math.abs(remaining))}`}
          </Badge>
          <span className="text-muted-foreground">
            Soma mensal: {formatCurrency(monthlySum)}
          </span>
        </div>

        <Separator />

        {/* Monthly grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {MONTHS.map((m, i) => {
            const pct = annualGoal > 0 ? (monthlyGoals[m] / annualGoal) * 100 : 0;
            return (
              <div key={m} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-medium text-muted-foreground">{MONTH_SHORT[i]}</Label>
                  <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
                </div>
                <Input
                  type="text"
                  value={monthlyGoals[m] ? monthlyGoals[m].toLocaleString("pt-BR") : ""}
                  onChange={(e) => handleMonthChange(m, parseInputNumber(e.target.value))}
                  placeholder="0"
                  className="h-8 text-xs text-center"
                />
                {/* Mini progress bar */}
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", pct > 0 ? "bg-primary" : "")}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Save */}
        {isDirty && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={upsertGoal.isPending} className="gap-2">
              {upsertGoal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Meta
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
