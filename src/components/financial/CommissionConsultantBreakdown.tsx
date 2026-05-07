import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Users, Briefcase, ShieldCheck } from "lucide-react";
import { useCommissionPlan, type CommissionDealEntry } from "@/hooks/useCommissionPlan";
import { Skeleton } from "@/components/ui/skeleton";
import { CommissionApprovalDialog } from "./CommissionApprovalDialog";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v || 0);

const initials = (n: string) =>
  n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  partial: { label: "Parcial", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  released: { label: "Liberada", className: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  paid: { label: "Paga", className: "bg-green-500/10 text-green-600 border-green-500/30" },
};

interface ConsultantGroup {
  userId: string;
  name: string;
  avatar: string | null;
  cargo: "Closer" | "SDR";
  entries: CommissionDealEntry[];
  totalDealValue: number;
  totalCommission: number;
  releasedCommission: number;
  pendingCommission: number;
  avgPercent: number;
}

function groupByUser(entries: CommissionDealEntry[], cargo: "Closer" | "SDR"): ConsultantGroup[] {
  const map = new Map<string, ConsultantGroup>();
  for (const e of entries) {
    const key = e.user_id;
    const cur = map.get(key) || {
      userId: e.user_id,
      name: e.user_name || "Sem nome",
      avatar: e.user_avatar || null,
      cargo,
      entries: [],
      totalDealValue: 0,
      totalCommission: 0,
      releasedCommission: 0,
      pendingCommission: 0,
      avgPercent: 0,
    };
    cur.entries.push(e);
    cur.totalDealValue += Number(e.deal_value || 0);
    cur.totalCommission += Number(e.commission_total || 0);
    cur.releasedCommission += Number(e.commission_released || 0);
    cur.pendingCommission += Number(e.commission_pending || 0);
    map.set(key, cur);
  }
  return Array.from(map.values())
    .map((g) => ({
      ...g,
      avgPercent:
        g.totalDealValue > 0 ? (g.totalCommission / g.totalDealValue) * 100 : 0,
    }))
    .sort((a, b) => b.totalCommission - a.totalCommission);
}

function ConsultantRow({ group, plan }: { group: ConsultantGroup; plan: any }) {
  const [open, setOpen] = useState(false);
  const [approvalEntry, setApprovalEntry] = useState<CommissionDealEntry | null>(null);

  const tierName = useMemo(() => {
    if (!plan?.tiers?.length) return null;
    // Use sum of deal_value as proxy for achievement; show the best matching tier
    const value = group.totalDealValue;
    const tier =
      [...plan.tiers]
        .sort((a: any, b: any) => (a.min_value ?? 0) - (b.min_value ?? 0))
        .reverse()
        .find((t: any) => value >= (t.min_value ?? 0)) || plan.tiers[0];
    return tier?.tier_name || null;
  }, [plan, group.totalDealValue]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full text-left p-4 hover:bg-muted/40 transition-colors rounded-t-lg"
          >
            <div className="flex items-center gap-3">
              {open ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <Avatar className="h-9 w-9">
                <AvatarImage src={group.avatar || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {initials(group.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{group.name}</span>
                  <Badge
                    variant="outline"
                    className={
                      group.cargo === "Closer"
                        ? "text-[10px] border-primary/40 text-primary"
                        : "text-[10px] border-violet-500/40 text-violet-600"
                    }
                  >
                    {group.cargo}
                  </Badge>
                  {tierName && (
                    <Badge variant="secondary" className="text-[10px]">
                      Faixa: {tierName}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {group.entries.length} negócio(s) ganho(s) · ticket médio{" "}
                  {fmtBRL(group.totalDealValue / Math.max(1, group.entries.length))}
                </p>
              </div>
              <div className="hidden sm:grid grid-cols-4 gap-4 text-right">
                <div>
                  <p className="text-[10px] text-muted-foreground">Volume</p>
                  <p className="text-sm font-semibold">{fmtBRL(group.totalDealValue)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">% médio</p>
                  <p className="text-sm font-semibold">{group.avgPercent.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Comissão</p>
                  <p className="text-sm font-bold text-primary">
                    {fmtBRL(group.totalCommission)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Pendente</p>
                  <p className="text-sm font-semibold text-amber-600">
                    {fmtBRL(group.pendingCommission)}
                  </p>
                </div>
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Negócio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Pagamento</TableHead>
                  <TableHead className="text-right">% aplicado</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center w-[110px]">Aprovação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.entries.map((e) => {
                  const status =
                    STATUS_LABEL[e.commission_status] || STATUS_LABEL.pending;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm font-medium max-w-[220px] truncate">
                        {e.deal_title || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                        {e.client_name || "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {fmtBRL(e.deal_value)}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {e.payment_method || "—"}
                        {e.installments_count > 1 && ` (${e.installments_count}x)`}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {Number(e.commission_percent || 0).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-primary">
                        {fmtBRL(e.commission_total)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[10px] ${status.className}`}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => setApprovalEntry(e)}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ShieldCheck className="h-3 w-3" />
                          {(e as any).approval_status === "approved"
                            ? "Aprovada"
                            : (e as any).approval_status === "pending_approval"
                            ? "Pendente"
                            : (e as any).approval_status === "rejected"
                            ? "Rejeitada"
                            : "Aprovar"}
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {plan && (
              <div className="mt-4 rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <p className="font-semibold text-foreground">
                  Regra aplicada — Plano {group.cargo}: {plan.name}
                </p>
                <p className="text-muted-foreground">
                  Meta mensal: {fmtBRL(Number(plan.monthly_quota || 0))} ·
                  Modo de faixas: {plan.tier_mode === "absolute" ? "valor absoluto" : "% da meta"}
                </p>
                {plan.tiers?.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {plan.tiers.map((t: any) => (
                      <div
                        key={t.id || t.tier_name}
                        className="rounded border bg-background p-2"
                      >
                        <p className="text-[10px] text-muted-foreground">{t.tier_name}</p>
                        <p className="text-xs font-semibold">
                          {Number(t.commission_percent || 0).toFixed(2)}%
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
      <CommissionApprovalDialog
        open={!!approvalEntry}
        onOpenChange={(v) => !v && setApprovalEntry(null)}
        entry={approvalEntry}
      />
    </Collapsible>
  );
}

export function CommissionConsultantBreakdown() {
  const closer = useCommissionPlan("Closer");
  const sdr = useCommissionPlan("SDR");

  const loading = closer.loading || sdr.loading;

  const closerGroups = useMemo(
    () => groupByUser(closer.dealEntries, "Closer"),
    [closer.dealEntries],
  );
  const sdrGroups = useMemo(
    () => groupByUser(sdr.dealEntries, "SDR"),
    [sdr.dealEntries],
  );

  const allGroups = [...closerGroups, ...sdrGroups];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <div>
            <CardTitle className="text-base">Detalhamento por Consultor</CardTitle>
            <CardDescription>
              Negócios ganhos do pipeline que entraram no cálculo de cada vendedor e a regra aplicada.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : allGroups.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-50" />
            Nenhum negócio ganho encontrado para o período atual.
          </div>
        ) : (
          <>
            {closerGroups.map((g) => (
              <ConsultantRow key={`closer-${g.userId}`} group={g} plan={closer.plan} />
            ))}
            {sdrGroups.map((g) => (
              <ConsultantRow key={`sdr-${g.userId}`} group={g} plan={sdr.plan} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
