import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Search, Inbox, Download, ChevronLeft, ChevronRight, Check,
  RotateCcw, Save, AlertTriangle, Layers,
} from "lucide-react";
import { OPEN_ITEM_META, OPEN_ITEM_RULE } from "@/components/settings/DeactivateUserDialog";
import {
  ItemSelection, emptySelection, isRoutineTitle, readSelection, writeSelection,
} from "@/lib/settings/openItemsSelection";

interface Row {
  id: string;
  title: string;
  status: string | null;
  date: string | null;
  created_at: string | null;
}

interface TitleGroup { title: string; count: number }

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo", paused: "Pausado", churn_risk: "Risco de churn",
  pending: "Pendente", in_progress: "Em andamento", overdue: "Atrasado",
  new: "Novo", contacted: "Em contato", qualified: "Qualificado",
  open: "Aberto", scheduled: "Agendado", confirmed: "Confirmado",
  rescheduled: "Remarcado", waiting: "Aguardando", triage: "Triagem",
};
const statusLabel = (s?: string | null) =>
  !s ? "Sem situação" : STATUS_LABELS[s] || s.replace(/_/g, " ");

const fmtDate = (d?: string | null) => {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt.toLocaleDateString("pt-BR");
};

export default function TeamOpenItems() {
  const [params] = useSearchParams();
  const userId = params.get("user") || "";
  const itemKey = params.get("item") || "";

  const meta = OPEN_ITEM_META[itemKey];
  const rule = OPEN_ITEM_RULE[itemKey];

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [targetName, setTargetName] = useState("");
  const [targetEmail, setTargetEmail] = useState("");

  const [groups, setGroups] = useState<TitleGroup[]>([]);
  const [statuses, setStatuses] = useState<{ status: string; count: number }[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"recent" | "oldest" | "title" | "due">("recent");

  const [selection, setSelection] = useState<ItemSelection>(emptySelection());
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    document.title = meta ? `${meta.label} — pendências` : "Pendências em aberto";
  }, [meta]);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Blocos de título + situações disponíveis
  useEffect(() => {
    if (!userId || !itemKey) return;
    let cancelled = false;
    (async () => {
      setGroupsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("deactivate-team-user", {
          body: { action: "title_groups", user_id: userId, item_key: itemKey },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (cancelled) return;
        setGroups(data.groups || []);
        setStatuses(data.statuses || []);
      } catch (err: any) {
        console.error(err);
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, itemKey]);

  const load = useCallback(async () => {
    if (!userId || !itemKey) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("deactivate-team-user", {
        body: {
          action: "list_open_items",
          user_id: userId,
          item_key: itemKey,
          page,
          page_size: pageSize,
          search: debounced,
          status: status === "all" ? null : status,
          sort,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRows(data.rows || []);
      setTotal(data.total || 0);
      setTargetName(data.target_name || "");
      setTargetEmail(data.target_email || "");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Não foi possível carregar os registros");
    } finally {
      setLoading(false);
    }
  }, [userId, itemKey, page, pageSize, debounced, status, sort]);

  useEffect(() => { load(); }, [load]);

  // Seleção inicial: recupera a salva ou desmarca a rotina genérica de prospecção.
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (initialized || groupsLoading || !userId || !itemKey) return;
    const saved = readSelection(userId, itemKey);
    if (saved) {
      setSelection(saved);
    } else {
      const routine = groups.filter((g) => isRoutineTitle(g.title)).map((g) => g.title);
      setSelection({
        ...emptySelection(),
        mode: routine.length > 0 ? "except" : "all",
        excludedTitles: routine,
      });
      if (routine.length > 0) setDirty(true);
    }
    setInitialized(true);
  }, [initialized, groupsLoading, groups, userId, itemKey]);

  const excludedTitleCount = useMemo(() => {
    const set = new Set(selection.excludedTitles);
    return groups.filter((g) => set.has(g.title)).reduce((s, g) => s + g.count, 0);
  }, [groups, selection.excludedTitles]);

  const selectedCount =
    selection.mode === "none"
      ? 0
      : Math.max(total - excludedTitleCount - selection.excludedIds.length, 0);

  const isTitleExcluded = (t: string) => selection.excludedTitles.includes(t);
  const isRowSelected = (r: Row) =>
    selection.mode !== "none" && !isTitleExcluded(r.title) && !selection.excludedIds.includes(r.id);

  /** Sai do estado "nada marcado" mantendo apenas o título reativado. */
  const reviveFrom = (title: string) => {
    setSelection({
      ...emptySelection(total),
      mode: "except",
      excludedTitles: groups.map((g) => g.title).filter((t) => t !== title),
      total,
    });
    setDirty(true);
  };

  const update = (patch: Partial<ItemSelection>) => {
    setSelection((s) => ({ ...s, ...patch, mode: "except" }));
    setDirty(true);
  };

  const toggleRow = (r: Row, on: boolean) => {
    if (on && selection.mode === "none") return reviveFrom(r.title);
    if (on) {
      update({
        excludedIds: selection.excludedIds.filter((id) => id !== r.id),
        excludedTitles: selection.excludedTitles.filter((t) => t !== r.title),
      });
    } else {
      update({ excludedIds: Array.from(new Set([...selection.excludedIds, r.id])) });
    }
  };

  const togglePage = (on: boolean) => {
    if (on) {
      const ids = new Set(rows.map((r) => r.id));
      const titles = new Set(rows.map((r) => r.title));
      update({
        excludedIds: selection.excludedIds.filter((id) => !ids.has(id)),
        excludedTitles: selection.excludedTitles.filter((t) => !titles.has(t)),
      });
    } else {
      update({ excludedIds: Array.from(new Set([...selection.excludedIds, ...rows.map((r) => r.id)])) });
    }
  };

  const toggleTitle = (title: string, on: boolean) => {
    if (on && selection.mode === "none") return reviveFrom(title);
    if (on) {
      update({ excludedTitles: selection.excludedTitles.filter((t) => t !== title) });
    } else {
      update({ excludedTitles: Array.from(new Set([...selection.excludedTitles, title])) });
    }
  };

  const markAll = () => {
    setSelection({ ...emptySelection(total), mode: "all", total, selectedCount: total });
    setDirty(true);
  };

  const save = () => {
    if (!userId || !itemKey) return;
    const payload: ItemSelection = {
      ...selection,
      total,
      selectedCount,
      updatedAt: new Date().toISOString(),
    };
    writeSelection(userId, itemKey, payload);
    setSelection(payload);
    setDirty(false);
    toast.success(
      selectedCount === total
        ? "Tudo marcado para transferir."
        : `${selectedCount} de ${total} marcados para transferir.`,
    );
  };

  const exportCsv = () => {
    const header = ["#", "Título", "Situação", "Data", "Transferir"];
    const lines = rows.map((r, i) => [
      String(i + 1 + (page - 1) * pageSize),
      `"${(r.title || "").replace(/"/g, '""')}"`,
      statusLabel(r.status),
      fmtDate(r.date || r.created_at) || "",
      isRowSelected(r) ? "Sim" : "Não",
    ].join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${itemKey}-${targetName || "membro"}-p${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lastPage = Math.max(Math.ceil(total / pageSize), 1);
  const routineExcluded = useMemo(
    () => selection.excludedTitles.filter(isRoutineTitle).length,
    [selection.excludedTitles],
  );

  if (!userId || !itemKey || !meta) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center text-muted-foreground">
        Endereço inválido. Abra esta tela pelo botão "Ver" na janela de inativação.
      </div>
    );
  }

  const allPageSelected = rows.length > 0 && rows.every(isRowSelected);

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Pendências em aberto
            </p>
            <h1 className="truncate text-lg font-semibold">{meta.label}</h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {targetName || "Carregando..."}
              {targetEmail ? ` · ${targetEmail}` : ""} — {rule}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-border/60 bg-card px-4 py-2 text-center">
              <p className="text-lg font-semibold leading-none">{total}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">em aberto</p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-center">
              <p className="text-lg font-semibold leading-none text-primary">{selectedCount}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">a transferir</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-5">
        {routineExcluded > 0 && (
          <div className="mb-4 flex gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              {excludedTitleCount} registro(s) de rotina genérica de prospecção foram desmarcados
              automaticamente. Revise ao lado se quiser incluir algum.
            </span>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Blocos de título */}
          <aside className="rounded-xl border border-border/60 bg-card p-3">
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Layers className="h-3.5 w-3.5" /> Blocos repetidos
            </p>
            {groupsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : groups.length === 0 ? (
              <p className="px-1 py-4 text-xs text-muted-foreground">
                Este tipo de pendência não tem títulos repetidos para agrupar.
              </p>
            ) : (
              <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
                {groups.map((g) => {
                  const on = !isTitleExcluded(g.title);
                  return (
                    <div
                      key={g.title}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                        on ? "hover:bg-muted/60" : "opacity-55 hover:opacity-100"
                      }`}
                    >
                      <Checkbox checked={on} onCheckedChange={(v) => toggleTitle(g.title, !!v)} />
                      <button
                        type="button"
                        onClick={() => { setSearch(g.title); }}
                        className="min-w-0 flex-1 truncate text-left"
                        title={g.title}
                      >
                        {g.title}
                      </button>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {g.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Lista */}
          <section className="overflow-hidden rounded-xl border border-border/60 bg-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por título..."
                  className="h-9 pl-9"
                />
              </div>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-[190px]">
                  <SelectValue placeholder="Todas as situações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as situações</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s.status} value={s.status}>
                      {statusLabel(s.status)} ({s.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v: any) => { setSort(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="oldest">Mais antigos</SelectItem>
                  <SelectItem value="title">Por título</SelectItem>
                  <SelectItem value="due">Por data</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-9 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 por página</SelectItem>
                  <SelectItem value="100">100 por página</SelectItem>
                  <SelectItem value="200">200 por página</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9" onClick={exportCsv} disabled={rows.length === 0}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-2 text-xs">
              <Checkbox
                checked={allPageSelected}
                onCheckedChange={(v) => togglePage(!!v)}
                disabled={rows.length === 0}
              />
              <span className="text-muted-foreground">
                {allPageSelected ? "Desmarcar esta página" : "Marcar esta página"}
              </span>
              <span className="mx-1 text-border">|</span>
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={markAll}>
                <Check className="mr-1 h-3 w-3" /> Marcar tudo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => {
                  setSelection({
                    ...emptySelection(total),
                    mode: "none",
                    total,
                    selectedCount: 0,
                  });
                  setDirty(true);
                }}
              >
                <RotateCcw className="mr-1 h-3 w-3" /> Desmarcar tudo
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-20 text-sm text-muted-foreground">
                <Inbox className="h-7 w-7" />
                Nenhum registro encontrado com esses filtros.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {rows.map((r, i) => {
                  const on = isRowSelected(r);
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                        on ? "hover:bg-muted/40" : "bg-muted/20 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <Checkbox checked={on} onCheckedChange={(v) => toggleRow(r, !!v)} />
                      <span className="w-10 shrink-0 text-right text-[11px] text-muted-foreground">
                        {(page - 1) * pageSize + i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{r.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {fmtDate(r.date) ? `Data: ${fmtDate(r.date)}` : fmtDate(r.created_at) ? `Criado em ${fmtDate(r.created_at)}` : "Sem data"}
                          {isTitleExcluded(r.title) ? " · bloco desmarcado" : ""}
                        </p>
                      </div>
                      {r.status && (
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {statusLabel(r.status)}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2.5 text-xs text-muted-foreground">
              <span>
                Página {page} de {lastPage} · {total} registro(s) no filtro
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm" className="h-8"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </Button>
                <Button
                  variant="outline" size="sm" className="h-8"
                  disabled={page >= lastPage || loading}
                  onClick={() => setPage((p) => Math.min(p + 1, lastPage))}
                >
                  Próxima <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Rodapé fixo */}
      <footer className="sticky bottom-0 z-20 border-t border-border/60 bg-background/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="font-semibold">{selectedCount}</span> de {total} serão transferidos ·{" "}
            <span className="text-muted-foreground">
              {total - selectedCount} ficam como estão
            </span>
          </p>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-warning">Alterações não salvas</span>}
            <Button variant="outline" onClick={() => window.close()}>Fechar guia</Button>
            <Button onClick={save} disabled={!dirty}>
              <Save className="mr-2 h-4 w-4" /> Salvar seleção
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
