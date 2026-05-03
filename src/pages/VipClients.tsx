import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Crown, Search, Loader2, Settings } from "lucide-react";
import { differenceInMonths } from "date-fns";
import { toast } from "sonner";

interface VipRow {
  client_id: string;
  full_name: string;
  logo_url: string | null;
  total: number;
  received: number;
  pending: number;
  products: string[];
  product_ids: string[];
  start_date: string | null;
  ltv_months: number;
}

interface VipCriteria {
  min_received: number;
  min_ltv_months: number;
  product_ids: string[]; // empty = all
  top_n: number; // 0 = no cap
}

const DEFAULT_CRITERIA: VipCriteria = {
  min_received: 150000,
  min_ltv_months: 0,
  product_ids: [],
  top_n: 30,
};

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
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [criteria, setCriteria] = useState<VipCriteria>(DEFAULT_CRITERIA);
  const [criteriaLoaded, setCriteriaLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<VipCriteria>(DEFAULT_CRITERIA);
  const [savingCriteria, setSavingCriteria] = useState(false);

  // Load criteria from DB (shared across the team)
  useEffect(() => {
    const loadCriteria = async () => {
      if (!currentUser?.account_id) return;
      const { data } = await supabase
        .from("vip_criteria")
        .select("min_received, min_ltv_months, product_ids, top_n")
        .eq("account_id", currentUser.account_id)
        .maybeSingle();
      if (data) {
        setCriteria({
          min_received: Number(data.min_received) || 0,
          min_ltv_months: data.min_ltv_months || 0,
          product_ids: data.product_ids || [],
          top_n: data.top_n || 0,
        });
      }
      setCriteriaLoaded(true);
    };
    loadCriteria();
  }, [currentUser?.account_id]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser?.account_id) return;
      setLoading(true);

      const [{ data: contracts }, { data: entries }, { data: prods }] = await Promise.all([
        supabase
          .from("client_contracts")
          .select(
            "client_id, value, start_date, status, product_id, products(name), clients!inner(id, full_name, logo_url)"
          )
          .eq("account_id", currentUser.account_id)
          .not("status", "in", "(cancelled,dismissed,dropout_7d)"),
        supabase
          .from("financial_entries")
          .select("client_id, amount, status")
          .eq("account_id", currentUser.account_id)
          .eq("entry_type", "receivable")
          .not("client_id", "is", null),
        supabase
          .from("products")
          .select("id, name")
          .eq("account_id", currentUser.account_id)
          .eq("is_active", true)
          .order("name"),
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
            product_ids: [],
            start_date: c.start_date,
            ltv_months: 0,
          });
        }
        const row = map.get(cid)!;
        row.total += Number(c.value || 0);
        if (c.products?.name && !row.products.includes(c.products.name)) {
          row.products.push(c.products.name);
        }
        if (c.product_id && !row.product_ids.includes(c.product_id)) {
          row.product_ids.push(c.product_id);
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
        .map((r) => ({
          ...r,
          ltv_months: r.start_date
            ? Math.max(differenceInMonths(new Date(), new Date(r.start_date)), 0)
            : 0,
        }))
        .sort((a, b) => b.received - a.received || b.total - a.total);

      setRows(list);
      setProducts(prods || []);
      setLoading(false);
    };
    fetchData();
  }, [currentUser?.account_id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const target = criteria.top_n > 0 ? criteria.top_n : rows.length;

    const matchesProductFilter = (r: VipRow) => {
      if (criteria.product_ids.length === 0) return true;
      return r.product_ids.some((pid) => criteria.product_ids.includes(pid));
    };

    // Tier 1: meet min_received (+ LTV + product filter)
    const tier1 = rows.filter(
      (r) =>
        r.received >= criteria.min_received &&
        r.ltv_months >= criteria.min_ltv_months &&
        matchesProductFilter(r)
    );

    const selected = new Map<string, VipRow>();
    tier1.forEach((r) => selected.set(r.client_id, r));

    // Tier 2: fallback by elite products (Conselho / Private) — only if not enough
    if (selected.size < target) {
      const eliteRegex = /(conselho|private)/i;
      const tier2 = rows
        .filter(
          (r) =>
            !selected.has(r.client_id) &&
            r.products.some((p) => eliteRegex.test(p))
        )
        .sort((a, b) => b.received - a.received || b.total - a.total);
      for (const r of tier2) {
        if (selected.size >= target) break;
        selected.set(r.client_id, r);
      }
    }

    // Tier 3: fallback by LTV (longest first) — only if still not enough
    if (selected.size < target) {
      const tier3 = rows
        .filter((r) => !selected.has(r.client_id))
        .sort((a, b) => b.ltv_months - a.ltv_months || b.received - a.received);
      for (const r of tier3) {
        if (selected.size >= target) break;
        selected.set(r.client_id, r);
      }
    }

    let base = Array.from(selected.values()).sort(
      (a, b) => b.received - a.received || b.total - a.total
    );
    if (q) base = base.filter((r) => r.full_name.toLowerCase().includes(q));
    if (criteria.top_n > 0) base = base.slice(0, criteria.top_n);
    return base;
  }, [rows, search, criteria]);

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const saveCriteria = async () => {
    if (!currentUser?.account_id) return;
    setSavingCriteria(true);
    const { error } = await supabase
      .from("vip_criteria")
      .upsert(
        {
          account_id: currentUser.account_id,
          min_received: draft.min_received,
          min_ltv_months: draft.min_ltv_months,
          product_ids: draft.product_ids,
          top_n: draft.top_n,
          updated_by: currentUser.id,
        },
        { onConflict: "account_id" }
      );
    setSavingCriteria(false);
    if (error) {
      toast.error("Erro ao salvar critérios");
      return;
    }
    setCriteria(draft);
    setSettingsOpen(false);
    toast.success("Critérios atualizados para todo o time");
  };

  const resetCriteria = () => setDraft(DEFAULT_CRITERIA);

  const toggleProduct = (id: string) => {
    setDraft((d) => ({
      ...d,
      product_ids: d.product_ids.includes(id)
        ? d.product_ids.filter((p) => p !== id)
        : [...d.product_ids, id],
    }));
  };

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

        <Dialog
          open={settingsOpen}
          onOpenChange={(o) => {
            setSettingsOpen(o);
            if (o) setDraft(criteria);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings className="h-4 w-4" />
              Critérios VIP
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Critérios para cliente VIP</DialogTitle>
              <DialogDescription>
                Prioridade: <strong>Valor recebido</strong>. Se não houver clientes
                suficientes para o Top N, completa por <strong>produto Conselho/Private</strong>
                e, em seguida, por <strong>maior LTV</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label htmlFor="min_received">Valor mínimo recebido (R$)</Label>
                <Input
                  id="min_received"
                  type="number"
                  min={0}
                  step={1000}
                  value={draft.min_received}
                  onChange={(e) =>
                    setDraft({ ...draft, min_received: Number(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Soma dos recebíveis pagos do cliente.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_ltv">LTV mínimo (meses)</Label>
                <Input
                  id="min_ltv"
                  type="number"
                  min={0}
                  step={1}
                  value={draft.min_ltv_months}
                  onChange={(e) =>
                    setDraft({ ...draft, min_ltv_months: Number(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Tempo desde o primeiro contrato. Ex: 12 = pelo menos 1 ano.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Produtos elegíveis</Label>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {products.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum produto.</p>
                  ) : (
                    products.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={draft.product_ids.includes(p.id)}
                          onCheckedChange={() => toggleProduct(p.id)}
                        />
                        <span>{p.name}</span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Vazio = considera todos os produtos.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="top_n">Limite (Top N)</Label>
                <Input
                  id="top_n"
                  type="number"
                  min={0}
                  step={5}
                  value={draft.top_n}
                  onChange={(e) =>
                    setDraft({ ...draft, top_n: Number(e.target.value) || 0 })
                  }
                />
                <p className="text-xs text-muted-foreground">0 = sem limite.</p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={resetCriteria}>
                Restaurar padrão
              </Button>
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveCriteria} disabled={savingCriteria}>
                {savingCriteria ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
          {filtered.length === 1 ? "cliente VIP" : "clientes VIP"}
          {criteria.min_received > 0 && (
            <> · ≥ {formatBRL(criteria.min_received)} recebido</>
          )}
          {criteria.min_ltv_months > 0 && <> · ≥ {criteria.min_ltv_months} meses</>}
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            Nenhum cliente atende aos critérios.
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
