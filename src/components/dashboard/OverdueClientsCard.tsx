import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/financial-format";

interface OverdueClient {
  client_id: string;
  full_name: string;
  logo_url: string | null;
  responsible_user_id: string | null;
  responsible_name: string | null;
  overdue_amount: number;
  overdue_count: number;
  oldest_overdue_days: number;
}

/**
 * Card no dashboard CS: top clientes em atraso.
 * Escopo automático: filtra por responsible_user_id se o usuário não tem acesso total.
 */
export function OverdueClientsCard() {
  const { currentUser } = useCurrentUser();
  const { isAdmin } = usePermissions();
  const hasFullAccess = isAdmin;
  const [rows, setRows] = useState<OverdueClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.account_id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];

        // 1) Todas as parcelas vencidas em aberto (via financial_entries — a base compartilhada)
        const { data: entries, error } = await supabase
          .from("financial_entries")
          .select("client_id, amount, due_date")
          .eq("account_id", currentUser.account_id)
          .eq("entry_type", "receivable")
          .in("status", ["pending", "overdue", "partially_paid"])
          .lt("due_date", today)
          .not("client_id", "is", null);

        if (error) throw error;

        const byClient = new Map<
          string,
          { amount: number; count: number; maxDays: number }
        >();
        const now = Date.now();

        for (const row of entries || []) {
          if (!row.client_id) continue;
          const cur = byClient.get(row.client_id) || {
            amount: 0,
            count: 0,
            maxDays: 0,
          };
          cur.amount += Number(row.amount) || 0;
          cur.count += 1;
          const days = Math.floor(
            (now - new Date(row.due_date as string).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          if (days > cur.maxDays) cur.maxDays = days;
          byClient.set(row.client_id, cur);
        }

        if (byClient.size === 0) {
          if (!cancelled) setRows([]);
          return;
        }

        const clientIds = Array.from(byClient.keys());
        const { data: clients } = await supabase
          .from("clients")
          .select(
            "id, full_name, logo_url, responsible_user_id, users:responsible_user_id(name)",
          )
          .in("id", clientIds);

        let mapped: OverdueClient[] = (clients || []).map((c) => {
          const s = byClient.get(c.id)!;
          return {
            client_id: c.id,
            full_name: c.full_name || "—",
            logo_url: (c as any).logo_url,
            responsible_user_id: c.responsible_user_id,
            responsible_name: (c as any).users?.name || null,
            overdue_amount: s.amount,
            overdue_count: s.count,
            oldest_overdue_days: s.maxDays,
          };
        });

        // Escopo por responsável se não tem acesso total
        if (!hasFullAccess && currentUser.id) {
          mapped = mapped.filter(
            (r) => r.responsible_user_id === currentUser.id,
          );
        }

        // Ordena: primeiro os mais críticos
        mapped.sort((a, b) => {
          if (b.oldest_overdue_days !== a.oldest_overdue_days) {
            return b.oldest_overdue_days - a.oldest_overdue_days;
          }
          return b.overdue_amount - a.overdue_amount;
        });

        if (!cancelled) setRows(mapped.slice(0, 10));
      } catch (err) {
        console.error("[OverdueClientsCard] error:", err);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.account_id, currentUser?.id, hasFullAccess]);

  const total = rows.reduce((sum, r) => sum + r.overdue_amount, 0);

  return (
    <Card className="shadow-card border-l-4 border-l-red-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-danger" />
              Clientes em atraso
            </CardTitle>
            <CardDescription>
              {hasFullAccess
                ? "Top 10 clientes com maior atraso"
                : "Seus clientes com pagamento em atraso"}
            </CardDescription>
          </div>
          {!loading && rows.length > 0 && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total em aberto</div>
              <div className="text-lg font-bold text-danger">
                {formatBRL(total)}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhum cliente em atraso 🎉
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const initials = (r.full_name || "?")
                .split(" ")
                .map((p) => p[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();
              const isCritical = r.oldest_overdue_days > 30;
              return (
                <Link
                  key={r.client_id}
                  to={`/clients/${r.client_id}`}
                  className="flex items-center gap-3 rounded-lg border border-border p-2 hover:bg-muted/50 transition-colors group"
                >
                  <Avatar className="h-9 w-9">
                    {r.logo_url && <AvatarImage src={r.logo_url} />}
                    <AvatarFallback className="text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {r.full_name}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          isCritical
                            ? "bg-danger/10 text-danger border-danger/30 text-[10px]"
                            : "bg-warning/10 text-warning border-warning/30 text-[10px]"
                        }
                      >
                        {r.oldest_overdue_days}d
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.overdue_count} parcela{r.overdue_count > 1 ? "s" : ""} ·{" "}
                      {formatBRL(r.overdue_amount)}
                      {hasFullAccess && r.responsible_name && (
                        <> · {r.responsible_name}</>
                      )}
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
