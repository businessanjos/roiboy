import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Undo2, ArrowRight, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { Database, Json } from "@/integrations/supabase/types";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { usePagedList } from "@/hooks/usePagedList";
import { PagerFor } from "@/components/ui/list-pagination";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Operation = Database["public"]["Tables"]["bulk_deal_operations"]["Row"];
type Item = Database["public"]["Tables"]["bulk_deal_operation_items"]["Row"];
type LastMove = { id: string; changed_count: number; status: string; undone_at: string | null };
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const object = (value: Json | undefined): Record<string, Json | undefined> => value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
const actionTitle = (action: Json) => {
  const a = object(action);
  if (typeof a.description === "string") return a.description;
  return a.type === "move" ? "Mover funil / etapa" : a.type === "product" ? "Alterar produto" : a.type === "value" ? "Alterar valor" : "Alterar campo personalizado";
};

export function BulkDealHistoryDialog({ open, onOpenChange, onRefresh }: { open: boolean; onOpenChange: (value: boolean) => void; onRefresh: () => Promise<void> }) {
  const { currentUser } = useCurrentUser();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [message, setMessage] = useState("");
  const accountId = currentUser?.account_id;
  const operations = useQuery({
    queryKey: ["bulk-deal-history", accountId, "operations"], enabled: Boolean(open && accountId),
    queryFn: async () => {
      const { data, error } = await fetchAllRows<Operation>((from, to) => supabase.from("bulk_deal_operations").select("*").eq("account_id", accountId).order("created_at", { ascending: false }).order("id").range(from, to));
      if (error) throw error;
      return data;
    },
  });
  const last = useQuery({
    queryKey: ["bulk-deal-history", accountId, "last", currentUser?.auth_user_id], enabled: Boolean(open && accountId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_last_bulk_deal_move");
      if (error) throw error;
      return data as unknown as LastMove | null;
    },
  });
  const selected = operations.data?.find(op => op.id === selectedId);
  const items = useQuery({
    queryKey: ["bulk-deal-history", accountId, "items", selectedId], enabled: Boolean(open && selectedId),
    queryFn: async () => {
      if (!selectedId) return [];
      const { data, error } = await fetchAllRows<Item>((from, to) => supabase.from("bulk_deal_operation_items").select("*").eq("operation_id", selectedId).order("created_at").order("id").range(from, to));
      if (error) throw error;
      return data;
    },
  });
  const pg = usePagedList(operations.data, { isLoading: operations.isPending, resetKey: accountId });
  useEffect(() => { if (open) { setMessage(""); setConfirmUndo(false); } }, [open]);
  const canUndo = last.data?.id === selected?.id && selected?.actor_id === currentUser?.auth_user_id && last.data?.status !== "running" && !last.data?.undone_at && (last.data?.changed_count ?? 0) > 0;
  const undo = async () => {
    if (!canUndo || !selected || undoing) return;
    setUndoing(true); setMessage("");
    try {
      const { data, error } = await supabase.rpc("undo_last_bulk_deal_move", { p_operation: selected.id });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["bulk-deal-history"] });
      await qc.invalidateQueries({ queryKey: ["batch-deal-activity-status"] });
      await onRefresh();
      setConfirmUndo(false); setMessage(`${data} negócio${data === 1 ? " voltou" : "s voltaram"} ao destino anterior.`);
    } catch (error) { setMessage((error as { message?: string }).message || "Não foi possível desfazer. Nenhum negócio foi alterado."); }
    finally { setUndoing(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!undoing) onOpenChange(value); }}>
    <DialogContent className="flex max-h-[86dvh] w-[calc(100%_-_2rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-lg p-0" onEscapeKeyDown={event => { if (undoing) event.preventDefault(); }} onPointerDownOutside={event => { if (undoing) event.preventDefault(); }}>
      <DialogHeader className="shrink-0 border-b px-4 py-5 pr-14 text-left sm:px-6">
        <DialogTitle className="flex items-center gap-2 leading-snug"><History className="h-5 w-5 shrink-0 text-primary" />Histórico de alterações em massa</DialogTitle>
        <DialogDescription>Autor, resultados e movimentações do funil</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {operations.isPending ? <p role="status" className="p-6 text-sm text-muted-foreground">Carregando histórico…</p> : operations.isError ? <div role="alert" className="p-6"><p>Não foi possível carregar o histórico.</p><Button variant="outline" onClick={() => operations.refetch()}>Tentar novamente</Button></div> : !operations.data?.length ? <p className="p-6 text-sm text-muted-foreground">Nenhuma alteração em massa registrada.</p> : <div className="grid min-w-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="min-w-0 border-b md:border-b-0 md:border-r">
            {pg.items.map(op => <Button key={op.id} variant="ghost" onClick={() => { setSelectedId(op.id); setConfirmUndo(false); setMessage(""); }} aria-pressed={selectedId === op.id} className={`h-auto w-full justify-start rounded-none border-b px-4 py-3 text-left last:border-0 ${selectedId === op.id ? "bg-primary/10" : ""}`}>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium" title={actionTitle(op.action)}>{actionTitle(op.action)}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{op.actor_name} · {date(op.created_at)}</p>
                <p className="text-xs font-normal text-muted-foreground">{op.deal_ids.length} selecionados{op.undone_at ? " · Desfeita" : op.status === "running" ? " · Em andamento" : op.status === "interrupted" ? " · Interrompida" : ""}</p>
              </div><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>)}
          </div>
          <div className="min-w-0 p-4 sm:p-5">
            {!selected ? <p className="py-6 text-sm text-muted-foreground">Selecione uma alteração para ver os resultados.</p> : <>
              <h3 className="break-words text-sm font-semibold">{actionTitle(selected.action)}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{selected.actor_name} · {date(selected.created_at)}</p>
              {selected.undone_at && <p className="mt-2 text-xs text-muted-foreground">Desfeita em {date(selected.undone_at)}</p>}
              {items.isPending ? <p role="status" className="py-4 text-sm text-muted-foreground">Carregando negócios…</p> : items.isError ? <p role="alert" className="py-4 text-sm text-destructive">Não foi possível carregar os resultados.</p> : <ul className="mt-4 divide-y border-y">
                {items.data?.map(item => <li key={item.id} className="flex min-h-11 items-start gap-2 py-3">
                  {item.success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                  <div className="min-w-0 flex-1"><p className="break-words text-sm">{item.title}</p><p className="mt-1 break-words text-xs text-muted-foreground">{item.error || (item.undone_at ? "Movimentação desfeita" : item.changed ? "Alterado" : "Já estava com esse valor ou destino")}</p></div>
                </li>)}
              </ul>}
              {(items.data?.length ?? 0) < selected.deal_ids.length && <p className="mt-3 text-xs text-muted-foreground">Alguns negócios não foram processados ou seus detalhes não estão disponíveis ao seu acesso atual.</p>}
              {confirmUndo && <div className="mt-4 space-y-2 border-l-2 border-primary pl-3"><Badge variant="outline">Confirmar reversão</Badge><p className="text-sm">{last.data?.changed_count} negócios voltarão ao funil e à etapa anteriores.</p><p className="text-xs text-muted-foreground">Se algum tiver recebido outra movimentação, nenhum será alterado.</p></div>}
            </>}
          </div>
        </div>}
      </div>
      {message && <p role="status" className="shrink-0 border-t px-4 py-3 text-sm sm:px-6">{message}</p>}
      <DialogFooter className="shrink-0 flex-wrap gap-2 border-t px-4 py-4 sm:px-6 sm:space-x-0">
        {operations.data && operations.data.length > 0 && <div className="min-w-0 sm:mr-auto"><PagerFor state={pg} itemLabel="alterações" /></div>}
        <Button variant="outline" disabled={undoing} onClick={() => confirmUndo ? setConfirmUndo(false) : onOpenChange(false)} className="h-11">{confirmUndo ? "Cancelar" : "Fechar"}</Button>
        {canUndo && <Button disabled={undoing} onClick={() => confirmUndo ? void undo() : setConfirmUndo(true)} className="h-11 gap-2">{undoing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}{confirmUndo ? "Confirmar reversão" : "Desfazer última movimentação"}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}