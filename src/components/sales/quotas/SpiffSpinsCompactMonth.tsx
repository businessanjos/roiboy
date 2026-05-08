import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export function SpiffSpinsCompactMonth() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;

  const { start, end, label } = useMemo(() => {
    const now = new Date();
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      start: s.toISOString(),
      end: e.toISOString(),
      label: format(s, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  }, []);

  const spinsQ = useQuery({
    queryKey: ["spiff-spins-compact-month", accountId, start, end],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spiff_spins")
        .select("id, spiff_id, user_id, prize_amount, prize_label, spun_at, payment_status")
        .eq("account_id", accountId!)
        .gte("spun_at", start)
        .lt("spun_at", end)
        .order("spun_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const usersQ = useQuery({
    queryKey: ["spiffs-users-compact", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("account_id", accountId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const userById = useMemo(() => {
    const m = new Map<string, string>();
    (usersQ.data ?? []).forEach((u: any) => m.set(u.id, u.name || u.email || "—"));
    return m;
  }, [usersQ.data]);

  const rows = (spinsQ.data ?? []) as any[];

  const totals = useMemo(() => {
    const total = rows.reduce((a, r) => a + Number(r.prize_amount || 0), 0);
    const paid = rows.filter((r) => r.payment_status === "paid").reduce((a, r) => a + Number(r.prize_amount || 0), 0);
    return { total, paid, pending: total - paid, count: rows.length };
  }, [rows]);

  const isLoading = spinsQ.isLoading || usersQ.isLoading;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico de Giros — {label}
            </CardTitle>
            <CardDescription className="text-xs">
              {totals.count} giro{totals.count === 1 ? "" : "s"} · A pagar {formatBRL(totals.pending)} · Pago {formatBRL(totals.paid)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Nenhum giro neste mês ainda.
          </div>
        ) : (
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="h-9 text-xs">Data</TableHead>
                  <TableHead className="h-9 text-xs">Vendedor</TableHead>
                  <TableHead className="h-9 text-xs">Prêmio</TableHead>
                  <TableHead className="h-9 text-xs text-right">Valor</TableHead>
                  <TableHead className="h-9 text-xs text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(r.spun_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="py-2 text-xs font-medium">
                      {userById.get(r.user_id) || "—"}
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      {r.prize_label || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-right tabular-nums">
                      {Number(r.prize_amount) > 0
                        ? formatBRL(Number(r.prize_amount))
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      {r.payment_status === "paid" ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 text-[10px] h-5">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Pago
                        </Badge>
                      ) : Number(r.prize_amount) > 0 ? (
                        <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700 dark:text-amber-400 text-[10px] h-5">
                          <Clock className="h-2.5 w-2.5" /> A pagar
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] h-5">—</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
