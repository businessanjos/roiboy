import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, ListFilter, ArrowDownUp, Inbox, Download } from "lucide-react";
import { toast } from "sonner";

export interface OpenItemRow {
  id: string;
  title: string;
  status: string | null;
  date: string | null;
  created_at: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName?: string | null;
  itemKey: string | null;
  itemLabel: string;
  itemRule?: string;
  totalCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  churn_risk: "Risco de churn",
  pending: "Pendente",
  in_progress: "Em andamento",
  overdue: "Atrasado",
  new: "Novo",
  contacted: "Em contato",
  qualified: "Qualificado",
  open: "Aberto",
  scheduled: "Agendado",
  confirmed: "Confirmado",
  rescheduled: "Remarcado",
  waiting: "Aguardando",
  triage: "Triagem",
};

function statusLabel(s?: string | null) {
  if (!s) return "Sem situação";
  return STATUS_LABELS[s] || s.replace(/_/g, " ");
}

function fmtDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("pt-BR");
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function OpenItemsViewerDialog({
  open, onOpenChange, userId, userName, itemKey, itemLabel, itemRule, totalCount,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<OpenItemRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"recent" | "oldest" | "title">("recent");

  useEffect(() => {
    if (!open || !userId || !itemKey) return;
    setSearch("");
    setStatus("all");
    setSort("recent");
    setRows([]);
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("deactivate-team-user", {
          body: { action: "list_open_items", user_id: userId, item_key: itemKey },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setRows((data?.rows || []) as OpenItemRow[]);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Não foi possível carregar os registros");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, userId, itemKey]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.status && set.add(r.status));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    let list = rows.filter((r) => {
      if (status !== "all" && (r.status || "") !== status) return false;
      if (!q) return true;
      return normalize(r.title || "").includes(q) || normalize(r.status || "").includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sort === "title") return (a.title || "").localeCompare(b.title || "", "pt-BR");
      const ta = new Date(a.created_at || a.date || 0).getTime();
      const tb = new Date(b.created_at || b.date || 0).getTime();
      return sort === "recent" ? tb - ta : ta - tb;
    });
    return list;
  }, [rows, search, status, sort]);

  const exportCsv = () => {
    const header = ["Título", "Situação", "Data", "Criado em"];
    const lines = filtered.map((r) => [
      r.title, statusLabel(r.status), fmtDate(r.date) || "", fmtDate(r.created_at) || "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    const csv = [header.join(";"), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${itemKey}-${(userName || "usuario").replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b border-border/60 bg-muted/30 px-5 py-4 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            {itemLabel}
            <Badge variant="secondary" className="rounded-full">{totalCount} em aberto</Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {userName ? `Responsável atual: ${userName}. ` : ""}{itemRule}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 border-b border-border/60 px-5 py-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou situação..."
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-full text-xs sm:w-44">
              <ListFilter className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as situações</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="h-9 w-full text-xs sm:w-40">
              <ArrowDownUp className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigos</SelectItem>
              <SelectItem value="title">Ordem alfabética</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-h-0 flex-1">
          {loading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando registros...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Inbox className="h-6 w-6" />
              {rows.length === 0 ? "Nenhum registro em aberto." : "Nenhum registro para esse filtro."}
            </div>
          ) : (
            <ScrollArea className="h-[52vh]">
              <ul className="divide-y divide-border/50">
                {filtered.map((r, i) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <span className="w-7 shrink-0 text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{r.title}</span>
                      {(fmtDate(r.date) || fmtDate(r.created_at)) && (
                        <span className="block text-[11px] text-muted-foreground">
                          {fmtDate(r.date) ? `Data: ${fmtDate(r.date)}` : `Criado em ${fmtDate(r.created_at)}`}
                        </span>
                      )}
                    </span>
                    <Badge variant="outline" className="shrink-0 rounded-full text-[10px] font-normal">
                      {statusLabel(r.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-5 py-3">
          <p className="text-xs text-muted-foreground">
            Mostrando {filtered.length} de {rows.length} carregado(s) · {totalCount} em aberto
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="mr-1 h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
