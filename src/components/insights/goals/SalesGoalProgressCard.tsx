import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronUp, Pencil, Trash2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfigurableGauge } from "@/components/insights/visuals/ConfigurableGauge";
import {
  useSalesGoalProgress,
  type SalesGoal,
} from "@/hooks/useSalesGoals";

interface Props {
  goal: SalesGoal;
  sellerName: string;
  onEdit: () => void;
  onDelete: () => void;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

export function SalesGoalProgressCard({ goal, sellerName, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(true);
  const { data, isLoading } = useSalesGoalProgress(goal);

  const currentValue = goal.target_type === "revenue" ? data?.total ?? 0 : data?.count ?? 0;
  const target = Number(goal.target_value ?? 0);
  const pct = target > 0 ? Math.min((currentValue / target) * 100, 999) : 0;

  const fmt = (v: number) =>
    goal.target_type === "revenue" ? formatBRL(v) : `${v} negócio${v === 1 ? "" : "s"}`;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <span className="truncate">{sellerName}</span>
            <Badge variant="secondary">
              {goal.period_type === "weekly" ? "Semanal" : "Mensal"}
            </Badge>
            <Badge variant="outline">
              {goal.target_type === "revenue" ? "Receita ganha" : "Negócios ganhos"}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(goal.period_start + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
            {" – "}
            {format(new Date(goal.period_end + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} title="Editar">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} title="Remover">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 items-center">
          <div className="flex justify-center">
            <ConfigurableGauge
              value={currentValue}
              max={target || 1}
              label={fmt(currentValue)}
              sublabel={`Meta ${fmt(target)}`}
              formatValue={fmt}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Atingido" value={fmt(currentValue)} />
            <Stat label="Meta" value={fmt(target)} />
            <Stat
              label="Progresso"
              value={`${pct.toFixed(0)}%`}
              accent={pct >= 100 ? "text-success" : pct >= 75 ? "text-warning" : "text-warning"}
            />
            <Stat label="Negócios ganhos" value={String(data?.count ?? 0)} />
            <Stat label="Receita ganha" value={formatBRL(data?.total ?? 0)} />
            <Stat
              label="Faltam"
              value={fmt(Math.max(target - currentValue, 0))}
            />
          </div>
        </div>

        {open && (
          <div className="border rounded-md">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/40">
              Negócios que compõem esse progresso
            </div>
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Carregando negócios…</div>
            ) : (data?.deals ?? []).length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                Nenhum negócio ganho neste período ainda.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Negócio</TableHead>
                    <TableHead>Data de ganho</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.deals ?? []).map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium truncate max-w-[300px]">
                        {d.title || "(sem título)"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {d.won_at
                          ? format(new Date(d.won_at), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBRL(Number(d.value ?? 0))}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="icon">
                          <Link to={`/sales-pipeline?deal=${d.id}`} title="Abrir">
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="border rounded-md p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums truncate ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
