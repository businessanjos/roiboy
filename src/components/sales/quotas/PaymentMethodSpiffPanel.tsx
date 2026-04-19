import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreditCard } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Custom field IDs (account 796e7970-...)
const FORMA_PAGAMENTO_FIELD_ID = "b2cd2366-b990-43d9-a0b7-1b567fbed729";
const PARCELAS_FIELD_ID = "069ee7f8-befd-482d-990d-13048b17180c";

const formatBRL = (v: number) => v.toLocaleString("pt-BR");

// Tabela de faixas: 1x ou Pix/À vista = R$ 1.000; 2-3x = R$ 750; 4-6x = R$ 550; 7-10x = R$ 400; 11-12x = R$ 250
const TIERS = [
  { key: "tier_1k", label: "Pix / À vista / 1x", bonus: 1000, parcelasFn: (p: number, isCash: boolean) => isCash || p === 1, color: "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400" },
  { key: "tier_750", label: "2x ou 3x cartão", bonus: 750, parcelasFn: (p: number) => p === 2 || p === 3, color: "bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-400" },
  { key: "tier_550", label: "4x, 5x ou 6x cartão", bonus: 550, parcelasFn: (p: number) => p >= 4 && p <= 6, color: "bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-400" },
  { key: "tier_400", label: "7x, 8x, 9x ou 10x cartão", bonus: 400, parcelasFn: (p: number) => p >= 7 && p <= 10, color: "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-500" },
  { key: "tier_250", label: "11x ou 12x cartão", bonus: 250, parcelasFn: (p: number) => p === 11 || p === 12, color: "bg-orange-500/10 border-orange-500/40 text-orange-700 dark:text-orange-400" },
];

interface Props {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  periodLabel?: string;
}

export function PaymentMethodSpiffPanel({ startDate, endDate, periodLabel }: Props) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  // Closers ativos (Darlan e Vanessa)
  const closersQuery = useQuery({
    queryKey: ["payment-spiff-closers", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_collaborators")
        .select("user_id, full_name, position")
        .eq("account_id", accountId!)
        .not("user_id", "is", null)
        .or("position.ilike.%closer%,position.ilike.%executiv%");
      if (error) throw error;
      return (data ?? []).filter((c: any) => {
        const pos = (c.position || "").toLowerCase();
        return !pos.includes("sdr") && !pos.includes("gerente") && !pos.includes("manager");
      });
    },
    enabled: !!accountId,
  });

  const closerUserIds = (closersQuery.data ?? []).map((c) => c.user_id).filter(Boolean) as string[];

  // Vendas ganhas no período pelos Closers
  const dealsQuery = useQuery({
    queryKey: ["payment-spiff-deals", accountId, startDate, endDate, closerUserIds.join(",")],
    queryFn: async () => {
      if (closerUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("deals")
        .select("id, responsible_user_id, won_at, value")
        .eq("account_id", accountId!)
        .eq("status", "won")
        .in("responsible_user_id", closerUserIds)
        .gte("won_at", startDate)
        .lte("won_at", `${endDate}T23:59:59`);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!accountId && closerUserIds.length > 0,
  });

  // Custom field values (Forma da Pagamento + Parcelas) para esses deals
  const fieldValuesQuery = useQuery({
    queryKey: ["payment-spiff-fvs", accountId, (dealsQuery.data ?? []).map((d: any) => d.id).join(",")],
    queryFn: async () => {
      const dealIds = (dealsQuery.data ?? []).map((d: any) => d.id);
      if (dealIds.length === 0) return [];
      const { data, error } = await supabase
        .from("deal_field_values")
        .select("deal_id, field_id, value_text")
        .in("deal_id", dealIds)
        .in("field_id", [FORMA_PAGAMENTO_FIELD_ID, PARCELAS_FIELD_ID]);
      if (error) throw error;
      return data ?? [];
    },
    enabled: (dealsQuery.data ?? []).length > 0,
  });

  // Indexa values por deal
  const valuesByDeal = new Map<string, { forma?: string; parcelas?: number }>();
  for (const fv of fieldValuesQuery.data ?? []) {
    const cur = valuesByDeal.get(fv.deal_id) ?? {};
    if (fv.field_id === FORMA_PAGAMENTO_FIELD_ID) cur.forma = fv.value_text || undefined;
    if (fv.field_id === PARCELAS_FIELD_ID) cur.parcelas = fv.value_text ? Number(fv.value_text) : undefined;
    valuesByDeal.set(fv.deal_id, cur);
  }

  // Classifica cada venda em uma faixa
  const classifyTier = (forma?: string, parcelas?: number): typeof TIERS[number] | null => {
    const isCash = forma === "pix" || (parcelas !== undefined && parcelas === 0);
    const p = parcelas ?? -1;
    for (const tier of TIERS) {
      if (tier.parcelasFn(p, isCash)) return tier;
    }
    return null;
  };

  // Resumo por Closer
  const summary = closerUserIds.map((uid) => {
    const userDeals = (dealsQuery.data ?? []).filter((d: any) => d.responsible_user_id === uid);
    const collab = (closersQuery.data ?? []).find((c) => c.user_id === uid);
    const tierCounts: Record<string, { count: number; bonus: number }> = {};
    let totalBonus = 0;
    let unclassified = 0;
    for (const d of userDeals) {
      const fv = valuesByDeal.get(d.id);
      const tier = classifyTier(fv?.forma, fv?.parcelas);
      if (!tier) {
        unclassified += 1;
        continue;
      }
      const cur = tierCounts[tier.key] ?? { count: 0, bonus: 0 };
      cur.count += 1;
      cur.bonus += tier.bonus;
      tierCounts[tier.key] = cur;
      totalBonus += tier.bonus;
    }
    return {
      uid,
      name: collab?.full_name || "—",
      totalSales: userDeals.length,
      tierCounts,
      totalBonus,
      unclassified,
    };
  }).sort((a, b) => b.totalBonus - a.totalBonus || a.name.localeCompare(b.name));

  return (
    <div className="rounded-lg border-2 border-purple-500/30 bg-purple-500/5 p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <CreditCard className="h-4 w-4 text-purple-600" />
        <p className="text-sm font-medium">SPIFF — Forma de Pagamento (Closers)</p>
        {periodLabel && (
          <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-700 dark:text-purple-400">
            {periodLabel}
          </Badge>
        )}
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-[10px] cursor-help">como funciona?</Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <p className="text-xs">
              Bônus por venda baseado na forma de pagamento + parcelas (campos personalizados do negócio):
              {" "}Pix/À vista/1x = R$ 1.000 · 2-3x = R$ 750 · 4-6x = R$ 550 · 7-10x = R$ 400 · 11-12x = R$ 250.
              Vendas sem o campo "Parcelas" preenchido não pontuam.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Tabela de faixas (referência) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {TIERS.map((t) => (
          <div key={t.key} className={`rounded-md border px-2 py-1.5 text-center ${t.color}`}>
            <p className="text-[10px] font-medium leading-tight">{t.label}</p>
            <p className="text-sm font-bold tabular-nums">R$ {formatBRL(t.bonus)}</p>
          </div>
        ))}
      </div>

      {summary.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhum Closer ativo encontrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Closer</TableHead>
              <TableHead className="text-center text-xs">Vendas</TableHead>
              {TIERS.map((t) => (
                <TableHead key={t.key} className="text-center text-xs whitespace-nowrap">
                  R$ {formatBRL(t.bonus)}
                </TableHead>
              ))}
              <TableHead className="text-center text-xs">Bônus total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map((s) => (
              <TableRow key={s.uid}>
                <TableCell className="text-sm font-medium">
                  {s.name}
                  {s.unclassified > 0 && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="ml-1 text-[9px] border-muted-foreground/40 text-muted-foreground cursor-help">
                          {s.unclassified} sem dados
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{s.unclassified} venda(s) sem o campo "Parcelas" preenchido</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell className="text-center text-sm tabular-nums">{s.totalSales}</TableCell>
                {TIERS.map((t) => {
                  const cell = s.tierCounts[t.key];
                  return (
                    <TableCell key={t.key} className="text-center text-xs tabular-nums">
                      {cell ? (
                        <span className="font-medium">{cell.count}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center">
                  <Badge variant={s.totalBonus > 0 ? "default" : "secondary"} className="text-xs tabular-nums">
                    R$ {formatBRL(s.totalBonus)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
