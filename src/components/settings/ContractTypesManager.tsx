import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useContractCatalogRows } from "@/hooks/useContractCatalog";
import {
  CATALOG_COLOR_CLASSES, CATALOG_LISTS, mergeCatalog, slugifyCatalogValue,
  type CatalogColor, type CatalogItem, type CatalogListKey,
} from "@/lib/contracts/contractCatalog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, History, Loader2, Pencil, Plus, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COLORS: { value: CatalogColor; label: string }[] = [
  { value: "success", label: "Verde" }, { value: "info", label: "Azul" },
  { value: "warning", label: "Âmbar" }, { value: "danger", label: "Vermelho" }, { value: "muted", label: "Neutro" },
];

type Snapshot = Omit<CatalogItem, "is_builtin"> & { is_builtin?: boolean };

interface HistoryRow {
  id: string; list_key: string; value: string; action: string;
  before_data: Snapshot | null; after_data: Snapshot | null;
  changed_by_name: string | null; undone_at: string | null; created_at: string;
}

const ACTION_LABEL: Record<string, string> = { create: "criou", update: "alterou", undo: "desfez alteração em" };

function describeChange(h: HistoryRow): string {
  const b = h.before_data, a = h.after_data;
  if (!b && a) return `"${a.label}"`;
  if (b && !a) return `"${b.label}" (removido)`;
  if (!b || !a) return h.value;
  const parts: string[] = [];
  if (b.label !== a.label) parts.push(`nome "${b.label}" → "${a.label}"`);
  if (b.is_active !== a.is_active) parts.push(a.is_active ? "reativou" : "desativou");
  if ((b.color ?? "") !== (a.color ?? "")) parts.push("cor");
  if ((b.metric_bucket ?? "") !== (a.metric_bucket ?? "")) parts.push("como conta nas métricas");
  if ((b.description ?? "") !== (a.description ?? "")) parts.push("descrição");
  return `"${a.label}"${parts.length ? ": " + parts.join(", ") : ""}`;
}

const SCOPES = {
  contracts: {
    lists: ["contract_type", "contract_status"] as CatalogListKey[],
    title: "Contratos: tipos e status",
    description: "Listas usadas no cadastro e na edição de contratos. Tudo pode ser renomeado ou desativado (registros antigos continuam com o nome) e cada mudança fica no histórico, com opção de desfazer.",
  },
  renewals: {
    lists: ["renewal_status", "loss_reason"] as CatalogListKey[],
    title: "Renovações: status e motivos",
    description: "Listas usadas na aba Renovações, ao registrar o desfecho da renovação. Tudo pode ser renomeado ou desativado (registros antigos continuam com o nome) e cada mudança fica no histórico, com opção de desfazer.",
  },
};

export function ContractTypesManager({ scope = "contracts" }: { scope?: keyof typeof SCOPES }) {
  const cfg = SCOPES[scope];
  const LISTS = CATALOG_LISTS.filter((l) => cfg.lists.includes(l.key));
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useContractCatalogRows();
  const [tab, setTab] = useState<CatalogListKey>(cfg.lists[0]);
  const [newLabel, setNewLabel] = useState("");
  const [newBucket, setNewBucket] = useState<string>("");
  const [editing, setEditing] = useState<{ list: CatalogListKey; item: CatalogItem | null; draft: Snapshot } | null>(null);
  const [confirmBuiltIn, setConfirmBuiltIn] = useState(false);
  const [saving, setSaving] = useState(false);

  const history = useQuery({
    queryKey: ["contract-catalog-history", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_catalog_history")
        .select("id, list_key, value, action, before_data, after_data, changed_by_name, undone_at, created_at")
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as HistoryRow[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["contract-catalog"] });
    qc.invalidateQueries({ queryKey: ["contract-catalog-history"] });
  };

  const listMeta = CATALOG_LISTS.find((l) => l.key === tab)!;
  const items = useMemo(() => mergeCatalog(tab, rows), [tab, rows]);

  const writeItem = async (list: CatalogListKey, snap: Snapshot, isBuiltin: boolean) => {
    const { error } = await supabase.from("contract_catalog_options").upsert({
      account_id: accountId!, list_key: list, value: snap.value, label: snap.label,
      description: snap.description ?? null, color: snap.color ?? null, metric_bucket: snap.metric_bucket ?? null,
      is_active: snap.is_active, display_order: snap.display_order, is_builtin: isBuiltin,
      updated_by: currentUser?.id ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: "account_id,list_key,value" });
    return error;
  };

  const logHistory = (list: string, value: string, action: string, before: Snapshot | null, after: Snapshot | null, undoOf?: string) =>
    supabase.from("contract_catalog_history").insert({
      account_id: accountId!, list_key: list, value, action,
      before_data: before as any, after_data: after as any,
      changed_by: currentUser?.id ?? null, changed_by_name: currentUser?.name ?? null, undo_of: undoOf ?? null,
    });

  const add = async () => {
    const label = newLabel.trim();
    if (!label || !accountId) return;
    if (items.some((i) => i.label.toLowerCase() === label.toLowerCase())) return toast.error("Esse item já existe");
    if (listMeta.buckets && !newBucket) return toast.error("Escolha como esse status conta nas métricas");
    const base = slugifyCatalogValue(label);
    if (!base) return toast.error("Nome inválido");
    const taken = new Set(items.map((i) => i.value));
    let value = base, n = 2;
    while (taken.has(value)) value = `${base}_${n++}`;
    const snap: Snapshot = { value, label, is_active: true, display_order: items.length, metric_bucket: newBucket || null, color: listMeta.buckets ? "muted" : null };
    setSaving(true);
    const err = await writeItem(tab, snap, false);
    if (!err) await logHistory(tab, value, "create", null, snap);
    setSaving(false);
    if (err) return toast.error("Não foi possível adicionar");
    setNewLabel(""); setNewBucket("");
    toast.success("Item adicionado");
    refresh();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { list, item, draft } = editing;
    if (!draft.label.trim()) return toast.error("Informe um nome");
    if (item?.is_builtin && !confirmBuiltIn) { setConfirmBuiltIn(true); return; }
    setSaving(true);
    const snap = { ...draft, label: draft.label.trim() };
    const err = await writeItem(list, snap, !!item?.is_builtin);
    if (!err) await logHistory(list, snap.value, "update", item, snap);
    setSaving(false);
    if (err) return toast.error("Não foi possível salvar");
    toast.success(item?.is_builtin ? "Item padrão alterado — o time todo já vê a mudança" : "Alteração salva");
    setEditing(null); setConfirmBuiltIn(false);
    refresh();
  };

  const undo = async (h: HistoryRow) => {
    const list = h.list_key as CatalogListKey;
    const current = mergeCatalog(list, rows).find((i) => i.value === h.value) ?? null;
    setSaving(true);
    let err: any = null;
    if (h.before_data) {
      err = await writeItem(list, h.before_data, !!current?.is_builtin);
    } else {
      ({ error: err } = await supabase.from("contract_catalog_options").delete()
        .eq("account_id", accountId!).eq("list_key", list).eq("value", h.value));
    }
    if (!err) {
      await supabase.from("contract_catalog_history").update({ undone_at: new Date().toISOString() }).eq("id", h.id);
      await logHistory(list, h.value, "undo", current, h.before_data, h.id);
    }
    setSaving(false);
    if (err) return toast.error("Não foi possível desfazer");
    toast.success("Alteração desfeita");
    refresh();
  };

  const bucketLabel = (list: CatalogListKey, v?: string | null) =>
    CATALOG_LISTS.find((l) => l.key === list)?.buckets?.find((b) => b.value === v)?.label;

  const scopedHistory = (history.data || []).filter((h) => cfg.lists.includes(h.list_key as CatalogListKey));
  const recentBuiltInChanges = scopedHistory.filter((h) => h.action !== "undo" && !h.undone_at &&
    mergeCatalog(h.list_key as CatalogListKey, []).some((i) => i.value === h.value)).slice(0, 3);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{cfg.title}</CardTitle>
          <CardDescription>{cfg.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentBuiltInChanges.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Itens padrão foram alterados recentemente:{" "}
                {recentBuiltInChanges.map((h) => `${h.changed_by_name || "Alguém"} ${ACTION_LABEL[h.action] || "alterou"} ${describeChange(h)}`).join(" · ")}
              </AlertDescription>
            </Alert>
          )}
          <Tabs value={tab} onValueChange={(v) => { setTab(v as CatalogListKey); setNewBucket(""); }}>
            <TabsList className="flex h-auto flex-wrap justify-start">
              {LISTS.map((l) => <TabsTrigger key={l.key} value={l.key}>{l.title}</TabsTrigger>)}
            </TabsList>
            {LISTS.map((l) => (
              <TabsContent key={l.key} value={l.key} className="space-y-3">
                <p className="text-sm text-muted-foreground">{l.hint}</p>
                <div className="flex flex-wrap gap-2">
                  <Input className="min-w-[200px] flex-1" placeholder={`Novo item em ${l.title.toLowerCase()}`}
                    value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
                  {l.buckets && (
                    <Select value={newBucket} onValueChange={setNewBucket}>
                      <SelectTrigger className="w-[240px]"><SelectValue placeholder="Como conta nas métricas?" /></SelectTrigger>
                      <SelectContent>{l.buckets.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  <Button onClick={add} disabled={!newLabel.trim() || saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Adicionar
                  </Button>
                </div>
                <div className="divide-y rounded-md border">
                  {isLoading && <div className="px-3 py-2 text-sm text-muted-foreground">Carregando…</div>}
                  {items.map((i) => (
                    <div key={i.value} className={cn("flex flex-wrap items-center justify-between gap-2 px-3 py-2", !i.is_active && "opacity-60")}>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {i.color ? <Badge variant="outline" className={CATALOG_COLOR_CLASSES[i.color]}>{i.label}</Badge> : <span className="text-sm">{i.label}</span>}
                        {i.is_builtin && <Badge variant="secondary" className="text-[10px]">Padrão</Badge>}
                        {!i.is_active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                        {bucketLabel(l.key, i.metric_bucket) && <span className="text-xs text-muted-foreground">{bucketLabel(l.key, i.metric_bucket)}</span>}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => { setConfirmBuiltIn(false); setEditing({ list: l.key, item: i, draft: { ...i } }); }}>
                        <Pencil className="h-3.5 w-3.5" />Editar
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />Histórico de alterações</CardTitle>
          <CardDescription>Quem mudou, quando e o quê. Use "Desfazer" para voltar ao estado anterior.</CardDescription>
        </CardHeader>
        <CardContent>
          {scopedHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma alteração ainda.</p>
          ) : (
            <div className="max-h-[420px] divide-y overflow-y-auto rounded-md border">
              {scopedHistory.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{h.changed_by_name || "Alguém"}</span>{" "}
                    {ACTION_LABEL[h.action] || h.action} {describeChange(h)}
                    <span className="text-muted-foreground"> · {CATALOG_LISTS.find((l) => l.key === h.list_key)?.title}</span>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {h.undone_at && " · desfeita"}
                    </div>
                  </div>
                  {h.action !== "undo" && !h.undone_at && (
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => undo(h)}>
                      <Undo2 className="h-3.5 w-3.5" />Desfazer
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setConfirmBuiltIn(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar item</DialogTitle>
            <DialogDescription>{editing && CATALOG_LISTS.find((l) => l.key === editing.list)?.title}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nome</Label>
                <Input value={editing.draft.label} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, label: e.target.value } })} /></div>
              {editing.list === "loss_reason" && (
                <div className="space-y-1"><Label>Descrição (opcional)</Label>
                  <Textarea rows={2} value={editing.draft.description ?? ""} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, description: e.target.value || null } })} /></div>
              )}
              {CATALOG_LISTS.find((l) => l.key === editing.list)?.buckets && (
                <>
                  <div className="space-y-1"><Label>Cor</Label>
                    <Select value={editing.draft.color ?? "muted"} onValueChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, color: v as CatalogColor } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{COLORS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div className="space-y-1"><Label>Como conta nas métricas</Label>
                    <Select value={editing.draft.metric_bucket ?? ""} onValueChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, metric_bucket: v } })}>
                      <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                      <SelectContent>{CATALOG_LISTS.find((l) => l.key === editing.list)!.buckets!.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                    </Select></div>
                </>
              )}
              <label className="flex items-center justify-between gap-2 text-sm">
                Disponível para seleção
                <Switch checked={editing.draft.is_active} onCheckedChange={(v) => setEditing({ ...editing, draft: { ...editing.draft, is_active: v } })} />
              </label>
              {editing.item?.is_builtin && (
                <Alert variant={confirmBuiltIn ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Este é um item padrão do sistema. A mudança vale para o time todo e pode alterar painéis e relatórios.
                    {confirmBuiltIn && " Clique em \"Confirmar alteração\" para seguir — dá para desfazer pelo histórico."}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setConfirmBuiltIn(false); }}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing?.item?.is_builtin && confirmBuiltIn ? "Confirmar alteração" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
