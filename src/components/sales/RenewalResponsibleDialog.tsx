import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Plus, ArrowLeft, BarChart3, Search } from "lucide-react";
import { toast } from "sonner";

export type CsUser = { id: string; name: string };

// Lista padrão (quando a empresa ainda não escolheu): Camila, Andréia, Everton, Jonathan
const DEFAULT_IDS = [
  "95828516-4536-45ab-93a2-4aa278081d33",
  "e0017d78-21d4-413a-befc-5197df7ad666",
  "de43a643-0109-4afb-ac35-be768dbf4090",
  "1232ec15-5f66-4b5f-9e74-f40d436f9d0f",
];

function normalize(list: any[]): CsUser[] {
  return (list || [])
    .filter((u: any) => u.is_active !== false && u.name && !/tester|suporte/i.test(u.name))
    .map((u: any) => ({ id: u.id, name: String(u.name).trim() }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function useResponsibleIds() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  return useQuery({
    queryKey: ["renewal-responsible-ids", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<string[]> => {
      const { data } = await (supabase as any)
        .from("account_settings")
        .select("renewal_responsible_user_ids")
        .eq("account_id", accountId)
        .maybeSingle();
      const ids = data?.renewal_responsible_user_ids as string[] | null;
      return ids && ids.length ? ids : DEFAULT_IDS;
    },
  });
}

export function useCsTeamUsers() {
  const { data: ids } = useResponsibleIds();
  return useQuery({
    queryKey: ["cs-team-users", ids],
    enabled: !!ids,
    queryFn: async (): Promise<CsUser[]> => {
      const { data } = await supabase.from("users").select("id, name, is_active").in("id", ids!);
      return normalize(data || []);
    },
  });
}

function useAllActiveUsers(enabled: boolean) {
  return useQuery({
    queryKey: ["renewal-all-users"],
    enabled,
    queryFn: async (): Promise<CsUser[]> => {
      const { data } = await supabase.from("users").select("id, name, is_active").eq("is_active", true);
      return normalize(data || []);
    },
  });
}

type RenewalDeal = { id: string; title: string | null; status: string | null; renewal_responsible_user_id: string; created_at: string };

function useRenewalDeals(enabled: boolean) {
  return useQuery({
    queryKey: ["renewal-deals-by-responsible"],
    enabled,
    queryFn: async (): Promise<RenewalDeal[]> => {
      const { data } = await (supabase as any)
        .from("deals")
        .select("id, title, status, renewal_responsible_user_id, created_at")
        .not("renewal_responsible_user_id", "is", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(2000);
      return data || [];
    },
  });
}

const STATUS_LABEL: Record<string, string> = { open: "Em aberto", won: "Ganha", lost: "Perdida" };

type Mode = "pick" | "manage" | "stats";

export function RenewalResponsibleDialog({
  open,
  currentId,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  currentId?: string | null;
  onCancel: () => void;
  onConfirm: (user: CsUser) => void;
}) {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  const [mode, setMode] = useState<Mode>("pick");
  const { data: ids = [] } = useResponsibleIds();
  const { data: users = [], isLoading } = useCsTeamUsers();
  const { data: allUsers = [], isLoading: loadingAll } = useAllActiveUsers(open);
  const { data: deals = [] } = useRenewalDeals(open);

  const [draft, setDraft] = useState<string[]>([]);
  const [manageQuery, setManageQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("open");
  const [personFilter, setPersonFilter] = useState("all");

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    deals.filter((d) => d.status === "open").forEach((d) => { m[d.renewal_responsible_user_id] = (m[d.renewal_responsible_user_id] || 0) + 1; });
    return m;
  }, [deals]);

  const nameOf = (id: string) => allUsers.find((u) => u.id === id)?.name ?? users.find((u) => u.id === id)?.name ?? "—";

  const close = () => { setMode("pick"); onCancel(); };

  const openManage = () => { setDraft(ids); setManageQuery(""); setMode("manage"); };

  const saveManage = async () => {
    if (!currentUser?.account_id) return;
    if (draft.length === 0) { toast.error("Escolha pelo menos uma pessoa."); return; }
    setSaving(true);
    const { data: existing } = await (supabase as any).from("account_settings").select("id").eq("account_id", currentUser.account_id).maybeSingle();
    const res = existing
      ? await (supabase as any).from("account_settings").update({ renewal_responsible_user_ids: draft }).eq("id", existing.id)
      : await (supabase as any).from("account_settings").insert({ account_id: currentUser.account_id, renewal_responsible_user_ids: draft });
    setSaving(false);
    if (res.error) { toast.error("Não foi possível salvar a lista."); return; }
    toast.success("Lista de responsáveis atualizada");
    await qc.invalidateQueries({ queryKey: ["renewal-responsible-ids"] });
    setMode("pick");
  };

  const filteredManage = allUsers.filter((u) => u.name.toLowerCase().includes(manageQuery.trim().toLowerCase()));
  const selectedFirst = [...filteredManage].sort((a, b) => Number(draft.includes(b.id)) - Number(draft.includes(a.id)));

  const [dealQuery, setDealQuery] = useState("");

  const personScoped = useMemo(
    () => deals.filter((d) => personFilter === "all" || d.renewal_responsible_user_id === personFilter),
    [deals, personFilter],
  );
  const statusTotals = useMemo(() => ({
    open: personScoped.filter((d) => d.status === "open").length,
    won: personScoped.filter((d) => d.status === "won").length,
    lost: personScoped.filter((d) => d.status === "lost").length,
    all: personScoped.length,
  }), [personScoped]);

  const byPersonAll = useMemo(() => {
    const m: Record<string, number> = {};
    deals.filter((d) => statusFilter === "all" || d.status === statusFilter)
      .forEach((d) => { m[d.renewal_responsible_user_id] = (m[d.renewal_responsible_user_id] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [deals, statusFilter]);
  const maxPerson = byPersonAll[0]?.[1] ?? 0;

  const statsRows = useMemo(() => {
    const q = dealQuery.trim().toLowerCase();
    const list = personScoped.filter((d) => (statusFilter === "all" || d.status === statusFilter) && (!q || (d.title ?? "").toLowerCase().includes(q)));
    return { list };
  }, [personScoped, statusFilter, dealQuery]);

  const title = mode === "manage" ? "Quem aparece na lista de responsáveis?" : mode === "stats" ? "Renovações por responsável" : "Quem é o responsável pela renovação?";
  const desc = mode === "manage" ? "Marque as pessoas que devem aparecer na lista principal." : mode === "stats" ? "Veja quantas renovações cada pessoa está cuidando." : "Escolha quem vai cuidar desta renovação.";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>

        {mode === "pick" && (
          <>
            <Command className="border rounded-md">
              <CommandInput placeholder="Buscar pessoa..." />
              <CommandList className="max-h-64 overflow-y-auto">
                <CommandEmpty>{isLoading ? "Carregando..." : "Ninguém encontrado."}</CommandEmpty>
                <CommandGroup>
                  {users.map((u) => (
                    <CommandItem key={u.id} value={u.name} onSelect={() => { setMode("pick"); onConfirm(u); }}>
                      <Check className={`mr-2 h-4 w-4 ${currentId === u.id ? "opacity-100" : "opacity-0"}`} />
                      <span className="flex-1 truncate">{u.name}</span>
                      <span className="text-xs text-muted-foreground" title="Renovações em aberto">{counts[u.id] || 0}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={openManage}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar outra pessoa
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setMode("stats")}>
                <BarChart3 className="mr-1 h-4 w-4" /> Ver renovações
              </Button>
            </div>
          </>
        )}

        {mode === "manage" && (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input autoFocus value={manageQuery} onChange={(e) => setManageQuery(e.target.value)} placeholder="Buscar pessoa..." className="pl-8" />
            </div>
            <p className="text-xs text-muted-foreground">{draft.length} selecionada{draft.length === 1 ? "" : "s"}</p>
            <div className="border rounded-md max-h-72 overflow-y-auto p-1">
              {loadingAll && <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>}
              {!loadingAll && selectedFirst.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Ninguém encontrado.</p>}
              {selectedFirst.map((u) => {
                const on = draft.includes(u.id);
                return (
                  <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent cursor-pointer min-w-0">
                    <Checkbox checked={on} onCheckedChange={() => setDraft((d) => on ? d.filter((x) => x !== u.id) : [...d, u.id])} className="shrink-0" />
                    <span className="truncate">{u.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => setMode("pick")}><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Button>
              <Button size="sm" onClick={saveManage} disabled={saving}>{saving ? "Salvando..." : "Salvar lista"}</Button>
            </div>
          </>
        )}

        {mode === "stats" && (
          <div className="flex flex-col gap-3 min-h-0">
            {/* Resumo por situação (clicável) */}
            <div className="grid grid-cols-4 gap-2">
              {([
                ["open", "Em aberto", statusTotals.open],
                ["won", "Ganhas", statusTotals.won],
                ["lost", "Perdidas", statusTotals.lost],
                ["all", "Todas", statusTotals.all],
              ] as const).map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`rounded-lg border px-2 py-2 text-left transition-colors ${statusFilter === key ? "border-primary bg-primary/10" : "hover:bg-accent"}`}
                >
                  <p className="text-[11px] text-muted-foreground truncate">{label}</p>
                  <p className="text-lg font-semibold leading-tight">{n}</p>
                </button>
              ))}
            </div>

            {/* Por responsável */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-muted-foreground">Por responsável</p>
                {personFilter !== "all" && (
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => setPersonFilter("all")}>Ver todas as pessoas</button>
                )}
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {byPersonAll.length === 0 && <p className="text-sm text-muted-foreground py-2">Nenhuma renovação nesta situação.</p>}
                {byPersonAll.map(([id, n]) => {
                  const active = personFilter === id;
                  const pct = maxPerson ? Math.round((n / maxPerson) * 100) : 0;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPersonFilter(active ? "all" : id)}
                      className={`w-full rounded-md border px-3 py-1.5 text-left transition-colors ${active ? "border-primary bg-primary/10" : "hover:bg-accent"}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-sm min-w-0">
                        <span className="truncate">{nameOf(id)}</span>
                        <span className="font-semibold shrink-0">{n}</span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lista de negócios */}
            <div className="flex flex-col gap-1.5 min-h-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">Negócios ({statsRows.list.length})</p>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={dealQuery} onChange={(e) => setDealQuery(e.target.value)} placeholder="Buscar negócio..." className="pl-8 h-9" />
              </div>
              <div className="border rounded-md max-h-56 overflow-y-auto divide-y">
                {statsRows.list.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum negócio encontrado.</p>}
                {statsRows.list.map((d) => (
                  <div key={d.id} className="px-3 py-2 text-sm min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex-1 truncate font-medium" title={d.title ?? ""}>{d.title || "Sem título"}</span>
                      <Badge variant="outline" className="shrink-0 text-[11px]">{STATUS_LABEL[d.status ?? ""] ?? d.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {nameOf(d.renewal_responsible_user_id)} · {new Date(d.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <Button variant="ghost" size="sm" className="self-start" onClick={() => setMode("pick")}><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
