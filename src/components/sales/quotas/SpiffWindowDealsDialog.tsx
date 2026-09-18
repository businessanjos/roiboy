import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveItemVendaToProductId } from "@/lib/sales/itemVendaResolver";
import { getSpiffWindow } from "@/lib/sales/spiffWindow";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ITEM_DA_VENDA_FIELD_ID = "033b91fb-3add-4c96-aec9-567fefbd0fb2";

const formatBRL = (v: number) => Math.round(v).toLocaleString("pt-BR");

/**
 * Mostra exatamente quais vendas formaram os giros de um SPIFF por janela
 * (ex.: hat trick = 3 vendas na semana), para vendedor e gestor auditarem.
 */
export function SpiffWindowDealsDialog({
  open,
  onOpenChange,
  spiff,
  userId,
  userName,
  referenceDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  spiff: any;
  userId: string;
  userName: string;
  /** Data de referência da janela (ex.: data da solicitação do giro). */
  referenceDate?: Date;
}) {
  const navigate = useNavigate();
  const win = getSpiffWindow(spiff, referenceDate ?? new Date());
  const triggerSalesCount = Number(spiff?.trigger_sales_count || 0);
  const targetProductId: string | null = spiff?.product_id || null;

  const { data, isLoading } = useQuery({
    queryKey: ["spiff-window-deals", spiff?.id, userId, win.start.toISOString(), win.end.toISOString()],
    enabled: open && !!userId,
    queryFn: async () => {
      const { data: deals, error } = await supabase
        .from("deals")
        .select("id, title, contact_name, value, entry_value, received_value, won_at, status")
        .eq("responsible_user_id", userId)
        .eq("status", "won")
        .gte("won_at", win.start.toISOString())
        .lte("won_at", win.end.toISOString())
        .order("won_at", { ascending: true });
      if (error) throw error;
      let rows = deals ?? [];

      const ids = rows.map((d: any) => d.id);
      let productByDeal = new Map<string, { name: string; color: string | null }>();
      if (ids.length > 0) {
        const { data: fvs } = await supabase
          .from("deal_field_values")
          .select("deal_id, value_text")
          .eq("field_id", ITEM_DA_VENDA_FIELD_ID)
          .in("deal_id", ids);

        if (targetProductId) {
          const matching = new Set(
            (fvs ?? [])
              .filter((f: any) => resolveItemVendaToProductId(f.value_text) === targetProductId)
              .map((f: any) => f.deal_id),
          );
          rows = rows.filter((d: any) => matching.has(d.id));
        }

        const productIds = Array.from(
          new Set((fvs ?? []).map((f: any) => resolveItemVendaToProductId(f.value_text)).filter(Boolean)),
        ) as string[];
        if (productIds.length > 0) {
          const { data: prods } = await supabase.from("products").select("id, name, color").in("id", productIds);
          const byId = new Map((prods ?? []).map((p: any) => [p.id, { name: p.name, color: p.color }]));
          (fvs ?? []).forEach((f: any) => {
            const pid = resolveItemVendaToProductId(f.value_text);
            const p = pid ? byId.get(pid) : undefined;
            if (p) productByDeal.set(f.deal_id, p);
          });
        }
      }

      return { rows, productByDeal };
    },
  });

  const rows = data?.rows ?? [];
  const total = rows.reduce((acc: number, d: any) => acc + Number(d.value || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base">Vendas que geraram o giro — {userName}</DialogTitle>
          <DialogDescription className="text-xs">
            {spiff?.name} · {win.label}
            {triggerSalesCount > 0 && <> · regra: {triggerSalesCount} vendas por janela</>}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto overflow-x-auto rounded-md border">
          <Table className="min-w-[620px]">
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="text-xs">Negociação</TableHead>
                <TableHead className="text-xs">Produto</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs text-center">Ganha em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-xs text-muted-foreground py-4 text-center">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-xs text-muted-foreground py-4 text-center">
                    Nenhuma venda encontrada nesta janela.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((d: any) => {
                const prod = data?.productByDeal.get(d.id);
                return (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/pipeline?deal=${d.id}`);
                    }}
                  >
                    <TableCell className="py-2">
                      <p className="text-xs font-medium leading-tight">{d.title || "Sem título"}</p>
                      {d.contact_name && (
                        <p className="text-[11px] text-muted-foreground leading-tight">{d.contact_name}</p>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      {prod ? (
                        <Badge
                          className="text-[10px] text-white border-transparent"
                          style={{ backgroundColor: prod.color || "#6b7280" }}
                        >
                          {prod.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-right tabular-nums">R$ {formatBRL(Number(d.value || 0))}</TableCell>
                    <TableCell className="py-2 text-xs text-center text-muted-foreground whitespace-nowrap">
                      {d.won_at ? new Date(d.won_at).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            {rows.length} venda{rows.length === 1 ? "" : "s"} na janela
          </span>
          <span className="font-semibold tabular-nums">Total: R$ {formatBRL(total)}</span>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
