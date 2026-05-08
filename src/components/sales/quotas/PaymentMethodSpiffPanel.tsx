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
const ITEM_DA_VENDA_FIELD_ID = "033b91fb-3add-4c96-aec9-567fefbd0fb2";

const formatBRL = (v: number) => v.toLocaleString("pt-BR");

const TIER_COLORS = [
  "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  "bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-400",
  "bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-400",
  "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-500",
  "bg-orange-500/10 border-orange-500/40 text-orange-700 dark:text-orange-400",
  "bg-pink-500/10 border-pink-500/40 text-pink-700 dark:text-pink-400",
  "bg-purple-500/10 border-purple-500/40 text-purple-700 dark:text-purple-400",
];

export interface PaymentTier {
  label: string;
  bonus: number;
  min_parcelas: number;
  max_parcelas: number;
  includes_cash: boolean;
}

interface Props {
  spiff: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    product_id: string | null;
    payment_tiers?: PaymentTier[] | null;
    participant_user_ids?: string[] | null;
  };
  restrictToUserId?: string;
}

export function PaymentMethodSpiffPanel({ spiff, restrictToUserId }: Props) {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const tiers: PaymentTier[] = Array.isArray(spiff.payment_tiers) ? spiff.payment_tiers : [];

  // Closers ativos
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

  const allCloserIds = (closersQuery.data ?? []).map((c) => c.user_id).filter(Boolean) as string[];
  const participantIds = Array.isArray(spiff.participant_user_ids) && spiff.participant_user_ids.length > 0
    ? spiff.participant_user_ids
    : allCloserIds;

  // Vendas ganhas no período
  const dealsQuery = useQuery({
    queryKey: ["payment-spiff-deals", accountId, spiff.id, spiff.start_date, spiff.end_date, participantIds.join(",")],
    queryFn: async () => {
      if (participantIds.length === 0) return [];
      const { data, error } = await supabase
        .from("deals")
        .select("id, responsible_user_id, won_at, value")
        .eq("account_id", accountId!)
        .eq("status", "won")
        .in("responsible_user_id", participantIds)
        .gte("won_at", spiff.start_date)
        .lte("won_at", `${spiff.end_date}T23:59:59`);
      if (error) throw error;
      let deals = data ?? [];

      // Filtro por produto-alvo via custom field "Item da Venda"
      if (spiff.product_id && deals.length > 0) {
        const dealIds = deals.map((d: any) => d.id);
        const { data: fvs } = await supabase
          .from("deal_field_values")
          .select("deal_id, value_text")
          .eq("field_id", ITEM_DA_VENDA_FIELD_ID)
          .in("deal_id", dealIds);
        const matchingIds = new Set((fvs ?? []).filter((f: any) => f.value_text === spiff.product_id).map((f: any) => f.deal_id));
        deals = deals.filter((d: any) => matchingIds.has(d.id));
      }
      return deals;
    },
    enabled: !!accountId && participantIds.length > 0,
  });

  // Custom field values (Forma + Parcelas)
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

  const valuesByDeal = new Map<string, { forma?: string; parcelas?: number }>();
  for (const fv of fieldValuesQuery.data ?? []) {
    const cur = valuesByDeal.get(fv.deal_id) ?? {};
    if (fv.field_id === FORMA_PAGAMENTO_FIELD_ID) cur.forma = fv.value_text || undefined;
    if (fv.field_id === PARCELAS_FIELD_ID) cur.parcelas = fv.value_text ? Number(fv.value_text) : undefined;
    valuesByDeal.set(fv.deal_id, cur);
  }

  const classifyTier = (forma?: string, parcelas?: number): { tier: PaymentTier; index: number } | null => {
    const isCash = forma === "pix" || (parcelas !== undefined && parcelas === 0);
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      if (isCash && t.includes_cash) return { tier: t, index: i };
      if (parcelas !== undefined && parcelas >= t.min_parcelas && parcelas <= t.max_parcelas) {
        return { tier: t, index: i };
      }
    }
    return null;
  };

  const summary = participantIds.map((uid) => {
    const userDeals = (dealsQuery.data ?? []).filter((d: any) => d.responsible_user_id === uid);
    const collab = (closersQuery.data ?? []).find((c) => c.user_id === uid);
    const tierCounts: Record<number, { count: number; bonus: number }> = {};
    let totalBonus = 0;
    let unclassified = 0;
    for (const d of userDeals as any[]) {
      const fv = valuesByDeal.get(d.id);
      const result = classifyTier(fv?.forma, fv?.parcelas);
      if (!result) { unclassified += 1; continue; }
      const cur = tierCounts[result.index] ?? { count: 0, bonus: 0 };
      cur.count += 1;
      cur.bonus += result.tier.bonus;
      tierCounts[result.index] = cur;
      totalBonus += result.tier.bonus;
    }
    return { uid, name: collab?.full_name || "—", totalSales: userDeals.length, tierCounts, totalBonus, unclassified };
  }).sort((a, b) => b.totalBonus - a.totalBonus || a.name.localeCompare(b.name));

  const visibleSummary = restrictToUserId ? summary.filter((s) => s.uid === restrictToUserId) : summary;

  // Se restrito e o usuário não é participante deste SPIFF, esconder o painel inteiro
  if (restrictToUserId && !participantIds.includes(restrictToUserId)) {
    return null;
  }

  if (tiers.length === 0) {
    return (
      <div className="rounded-lg border-2 border-purple-500/30 bg-purple-500/5 p-3">
        <p className="text-xs text-muted-foreground">SPIFF "{spiff.name}" sem faixas configuradas. Edite para adicionar.</p>
      </div>
    );
  }

  const periodLabel = `${new Date(spiff.start_date).toLocaleDateString("pt-BR")} → ${new Date(spiff.end_date).toLocaleDateString("pt-BR")}`;

  return (
    <div className="rounded-lg border-2 border-purple-500/30 bg-purple-500/5 p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <CreditCard className="h-4 w-4 text-purple-600" />
        <p className="text-sm font-medium">{spiff.name}</p>
        <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-700 dark:text-purple-400">
          {periodLabel}
        </Badge>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-[10px] cursor-help">como funciona?</Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <p className="text-xs">
              Bônus por venda baseado nas faixas configuradas (forma de pagamento + parcelas).
              Vendas sem o campo "Parcelas" preenchido não pontuam.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className={`grid gap-2 grid-cols-2 sm:grid-cols-${Math.min(tiers.length, 5)}`}>
        {tiers.map((t, i) => (
          <div key={i} className={`rounded-md border px-2 py-1.5 text-center ${TIER_COLORS[i % TIER_COLORS.length]}`}>
            <p className="text-[10px] font-medium leading-tight">{t.label}</p>
            <p className="text-sm font-bold tabular-nums">R$ {formatBRL(t.bonus)}</p>
          </div>
        ))}
      </div>

      {visibleSummary.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhum participante encontrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Closer</TableHead>
              <TableHead className="text-center text-xs">Vendas</TableHead>
              {tiers.map((t, i) => (
                <TableHead key={i} className="text-center text-xs whitespace-nowrap">
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
                {tiers.map((_, i) => {
                  const cell = s.tierCounts[i];
                  return (
                    <TableCell key={i} className="text-center text-xs tabular-nums">
                      {cell ? <span className="font-medium">{cell.count}</span> : <span className="text-muted-foreground">—</span>}
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
