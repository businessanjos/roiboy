import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Crown, Search, Loader2 } from "lucide-react";
import { differenceInMonths } from "date-fns";

interface VipRow {
  client_id: string;
  full_name: string;
  logo_url: string | null;
  total: number;
  received: number;
  pending: number;
  products: string[];
  start_date: string | null;
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatLTV = (start: string | null) => {
  if (!start) return "-";
  const months = differenceInMonths(new Date(), new Date(start));
  if (months < 12) return `${Math.max(months, 0)} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "ano" : "anos"}`;
};

export default function VipClients() {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const [rows, setRows] = useState<VipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [topN, setTopN] = useState<30 | 50 | 100>(30);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser?.account_id) return;
      setLoading(true);

      const [{ data: contracts }, { data: entries }] = await Promise.all([
        supabase
          .from("client_contracts")
          .select(
            "client_id, value, start_date, status, products(name), clients!inner(id, full_name, logo_url)"
          )
          .eq("account_id", currentUser.account_id)
          .not("status", "in", "(cancelled,dismissed,dropout_7d)"),
        supabase
          .from("financial_entries")
          .select("client_id, amount, status")
          .eq("account_id", currentUser.account_id)
          .eq("entry_type", "receivable")
          .not("client_id", "is", null),
      ]);

      const map = new Map<string, VipRow>();
      (contracts || []).forEach((c: any) => {
        const cid = c.client_id;
        if (!map.has(cid)) {
          map.set(cid, {
            client_id: cid,
            full_name: c.clients?.full_name || "—",
            logo_url: c.clients?.logo_url || null,
            total: 0,
            received: 0,
            pending: 0,
            products: [],
            start_date: c.start_date,
          });
        }
        const row = map.get(cid)!;
        row.total += Number(c.value || 0);
        if (c.products?.name && !row.products.includes(c.products.name)) {
          row.products.push(c.products.name);
        }
        if (c.start_date && (!row.start_date || c.start_date < row.start_date)) {
          row.start_date = c.start_date;
        }
      });

      (entries || []).forEach((e: any) => {
        const row = map.get(e.client_id);
        if (!row) return;
        const amt = Number(e.amount || 0);
        if (e.status === "paid") row.received += amt;
        else row.pending += amt;
      });

      const list = Array.from(map.values())
        .filter((r) => r.total > 0)
        .sort((a, b) => b.received - a.received || b.total - a.total);

      setRows(list);
      setLoading(false);
    };
    fetchData();
  }, [currentUser?.account_id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? rows.filter((r) => r.full_name.toLowerCase().includes(q))
      : rows;
    return base.slice(0, topN);
  }, [rows, search, topN]);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clientes VIP</h1>
            <p className="text-sm text-muted-foreground">
              Top clientes por valor recebido, LTV e produto. Tratamento diferenciado.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[30, 50, 100].map((n) => (
            <button
              key={n}
              onClick={() => setTopN(n as any)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                topN === n
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-muted"
              }`}
            >
              Top {n}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            Nenhum cliente encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold w-12">#</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Venda</th>
                  <th className="px-4 py-3 font-semibold text-right">Recebido</th>
                  <th className="px-4 py-3 font-semibold text-right">A Vencer</th>
                  <th className="px-4 py-3 font-semibold">Produto</th>
                  <th className="px-4 py-3 font-semibold">LTV</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr
                    key={r.client_id}
                    onClick={() => navigate(`/clients/${r.client_id}`)}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 font-semibold text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={r.logo_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(r.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{r.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatBRL(r.total)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                      {formatBRL(r.received)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatBRL(r.pending)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.products.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          r.products.map((p) => (
                            <Badge key={p} variant="secondary" className="text-xs">
                              {p}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatLTV(r.start_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
