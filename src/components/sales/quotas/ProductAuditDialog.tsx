import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isManagementUser } from "@/lib/access/managementRoles";
import { resolveItemVendaToProductId, PRODUCT_IDS } from "@/lib/sales/itemVendaResolver";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ExternalLink, AlertTriangle } from "lucide-react";

const ITEM_DA_VENDA_FIELD_ID = "033b91fb-3add-4c96-aec9-567fefbd0fb2";

const SIGLA_TO_PRODUCT: Record<string, string> = {
  EM: PRODUCT_IDS.EM,
  EML: PRODUCT_IDS.EML,
  EC: PRODUCT_IDS.EC,
  EP: PRODUCT_IDS.EP,
  RM: PRODUCT_IDS.RM,
  MVP: PRODUCT_IDS.MVP,
  CA: PRODUCT_IDS.CA,
  EPASS: PRODUCT_IDS.EPASS,
};

const RENEWAL_OF: Record<string, string> = {
  [PRODUCT_IDS.EM]: PRODUCT_IDS.REN_EM,
  [PRODUCT_IDS.EC]: PRODUCT_IDS.REN_EC,
  [PRODUCT_IDS.EP]: PRODUCT_IDS.REN_EP,
  [PRODUCT_IDS.RM]: PRODUCT_IDS.REN_RM,
};

/** Extrai a sigla do produto a partir do prefixo entre colchetes do título. */
export function expectedProductFromTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  const m = title.match(/\[([^\]]+)\]/);
  if (!m) return null;
  const prefix = m[1].toUpperCase();
  const parts = prefix.split(/[-\s/]+/).filter(Boolean);
  if (parts.length === 0) return null;
  const sigla = parts[parts.length - 1].replace(/[^A-Z]/g, "");
  const base = SIGLA_TO_PRODUCT[sigla];
  if (!base) return null;
  const isCarteira = prefix.includes("CARTEIRA");
  if (isCarteira && RENEWAL_OF[base]) return RENEWAL_OF[base];
  return base;
}

const PERIODS = [
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "365", label: "Últimos 12 meses" },
  { value: "all", label: "Todo o histórico" },
];

const fmtBRL = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

type Row = {
  id: string;
  title: string | null;
  contact_name: string | null;
  won_at: string | null;
  value: number | null;
  responsible_user_id: string | null;
  currentProductId: string;
  expectedProductId: string | null;
};

/** Conferência de produto das vendas já ganhas (gestor/admin). */
export function ProductAuditDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const canEdit = isManagementUser(currentUser as any);

  const [period, setPeriod] = useState("180");
  const [seller, setSeller] = useState("all");
  const [search, setSearch] = useState("");
  const [onlyMismatch, setOnlyMismatch] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ["audit-products", accountId],
    enabled: open && !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, color").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const dealsQuery = useQuery({
    queryKey: ["product-audit-deals", accountId, period],
    enabled: open && !!accountId,
    queryFn: async () => {
      let q = supabase
        .from("deals")
        .select("id, title, contact_name, value, won_at, responsible_user_id")
        .eq("account_id", accountId!)
        .eq("status", "won")
        .order("won_at", { ascending: false })
        .limit(2000);
      if (period !== "all") {
        const from = new Date();
        from.setDate(from.getDate() - Number(period));
        q = q.gte("won_at", from.toISOString());
      }
      const { data, error } = await q;
      if (error) throw error;
      const deals = data ?? [];

      // valores do campo "Item da Venda" em lotes (limite do PostgREST)
      const values = new Map<string, string>();
      const ids = deals.map((d) => d.id);
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data: fvs } = await supabase
          .from("deal_field_values")
          .select("deal_id, value_text")
          .eq("field_id", ITEM_DA_VENDA_FIELD_ID)
          .in("deal_id", chunk);
        (fvs ?? []).forEach((f: any) => values.set(f.deal_id, f.value_text));
      }

      const rows: Row[] = deals.map((d: any) => ({
        id: d.id,
        title: d.title,
        contact_name: d.contact_name,
        won_at: d.won_at,
        value: d.value,
        responsible_user_id: d.responsible_user_id,
        currentProductId: resolveItemVendaToProductId(values.get(d.id)),
        expectedProductId: expectedProductFromTitle(d.title),
      }));
      return rows;
    },
  });

  const usersQuery = useQuery({
    queryKey: ["product-audit-users", accountId],
    enabled: open && !!accountId,
    queryFn: async () => {
      const { data } = await supabase.from("users").select("id, name").eq("account_id", accountId!);
      return data ?? [];
    },
  });

  const productName = (id: string | null) =>
    (productsQuery.data ?? []).find((p: any) => p.id === id)?.name ?? null;
  const productColor = (id: string | null) =>
    (productsQuery.data ?? []).find((p: any) => p.id === id)?.color ?? "#6b7280";
  const userName = (id: string | null) => (usersQuery.data ?? []).find((u: any) => u.id === id)?.name ?? "—";

  const rows = useMemo(() => {
    const all = dealsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    return all.filter((r) => {
      const mismatch = !!r.expectedProductId && r.expectedProductId !== r.currentProductId;
      if (onlyMismatch && !mismatch) return false;
      if (seller !== "all" && r.responsible_user_id !== seller) return false;
      if (term) {
        const hay = `${r.title ?? ""} ${r.contact_name ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [dealsQuery.data, onlyMismatch, seller, search]);

  const sellers = useMemo(() => {
    const ids = new Set((dealsQuery.data ?? []).map((r) => r.responsible_user_id).filter(Boolean) as string[]);
    return Array.from(ids)
      .map((id) => ({ id, name: userName(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dealsQuery.data, usersQuery.data]);

  const changeProduct = async (row: Row, newProductId: string) => {
    if (!accountId || !currentUser) return;
    setSavingId(row.id);
    try {
      const { error } = await supabase.from("deal_field_values").upsert(
        {
          account_id: accountId,
          deal_id: row.id,
          field_id: ITEM_DA_VENDA_FIELD_ID,
          value_text: newProductId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "deal_id,field_id" },
      );
      if (error) throw error;

      await supabase.from("audit_logs").insert([
        {
          account_id: accountId,
          user_id: currentUser.id,
          user_name: (currentUser as any).name,
          user_email: (currentUser as any).email,
          action: "update",
          entity_type: "deal",
          entity_id: row.id,
          entity_name: row.title ?? "Negociação",
          details: {
            field: "Item da Venda",
            from: productName(row.currentProductId) ?? row.currentProductId ?? null,
            to: productName(newProductId) ?? newProductId,
            context: "Conferência de produto (venda ganha)",
          },
        },
      ]);

      toast.success("Produto atualizado e registrado no histórico.");
      dealsQuery.refetch();
    } catch (e: any) {
      console.error(e);
      toast.error("Não foi possível alterar o produto.");
    } finally {
      setSavingId(null);
    }
  };

  const exportCsv = () => {
    const head = ["Negociação", "Contato", "Vendedor", "Ganha em", "Valor", "Produto marcado", "Produto sugerido"];
    const lines = rows.map((r) =>
      [
        r.title ?? "",
        r.contact_name ?? "",
        userName(r.responsible_user_id),
        r.won_at ? new Date(r.won_at).toLocaleDateString("pt-BR") : "",
        String(Math.round(Number(r.value || 0))),
        productName(r.currentProductId) ?? "—",
        productName(r.expectedProductId) ?? "—",
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const csv = [head.join(";"), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `conferencia-produtos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Conferência de produto nas vendas ganhas
          </DialogTitle>
          <DialogDescription className="text-xs">
            Compara o produto marcado na venda com a sigla do título (ex.: <strong>[CARTEIRA-EM]</strong> deve ser
            Eternum Mentoring). Gestores podem corrigir o produto mesmo depois do ganho — toda troca fica registrada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={seller} onValueChange={setSeller}>
            <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Vendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os vendedores</SelectItem>
              {sellers.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar negociação ou contato"
            className="h-8 w-[220px] text-xs"
          />
          <Button
            size="sm"
            variant={onlyMismatch ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setOnlyMismatch((v) => !v)}
          >
            {onlyMismatch ? "Só divergências" : "Todas as vendas"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>

        <div className="max-h-[55vh] overflow-auto rounded-md border">
          <Table className="min-w-[860px]">
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="text-xs">Negociação</TableHead>
                <TableHead className="text-xs">Vendedor</TableHead>
                <TableHead className="text-xs text-center">Ganha em</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs">Produto marcado</TableHead>
                <TableHead className="text-xs">Sugerido</TableHead>
                <TableHead className="text-xs w-[210px]">Corrigir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dealsQuery.isLoading && (
                <TableRow><TableCell colSpan={7} className="py-6 text-center text-xs text-muted-foreground">Carregando…</TableCell></TableRow>
              )}
              {!dealsQuery.isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-6 text-center text-xs text-muted-foreground">Nenhuma divergência encontrada no período.</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="py-2">
                    <button
                      className="text-left"
                      onClick={() => { onOpenChange(false); navigate(`/pipeline?deal=${r.id}`); }}
                    >
                      <p className="text-xs font-medium leading-tight flex items-center gap-1">
                        {r.title || "Sem título"}
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </p>
                      {r.contact_name && <p className="text-[11px] text-muted-foreground leading-tight">{r.contact_name}</p>}
                    </button>
                  </TableCell>
                  <TableCell className="py-2 text-xs">{userName(r.responsible_user_id)}</TableCell>
                  <TableCell className="py-2 text-xs text-center whitespace-nowrap text-muted-foreground">
                    {r.won_at ? new Date(r.won_at).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="py-2 text-xs text-right tabular-nums">{fmtBRL(Number(r.value || 0))}</TableCell>
                  <TableCell className="py-2">
                    {r.currentProductId ? (
                      <Badge className="text-[10px] text-white border-transparent" style={{ backgroundColor: productColor(r.currentProductId) }}>
                        {productName(r.currentProductId) ?? "Desconhecido"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem produto</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {r.expectedProductId ? (
                      <Badge variant="outline" className="text-[10px]">{productName(r.expectedProductId) ?? "—"}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {canEdit ? (
                      <Select
                        value={r.currentProductId || undefined}
                        disabled={savingId === r.id}
                        onValueChange={(v) => changeProduct(r, v)}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Escolher produto" /></SelectTrigger>
                        <SelectContent>
                          {(productsQuery.data ?? []).map((p: any) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Somente gestor</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{rows.length} venda{rows.length === 1 ? "" : "s"} listada{rows.length === 1 ? "" : "s"}</span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
