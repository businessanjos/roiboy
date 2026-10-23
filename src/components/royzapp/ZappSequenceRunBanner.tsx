import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ListOrdered, X } from "lucide-react";
import { toast } from "sonner";

const db = supabase as any;

interface Run { id: string; sequence_name: string; sent_steps: number; total_steps: number; status: string }

export function ZappSequenceRunBanner({ conversationId }: { conversationId: string | null }) {
  const [run, setRun] = useState<Run | null>(null);

  const load = useCallback(async () => {
    if (!conversationId) { setRun(null); return; }
    const { data } = await db.from("zapp_sequence_runs")
      .select("id, sequence_name, sent_steps, total_steps, status")
      .eq("conversation_id", conversationId).eq("status", "running").maybeSingle();
    setRun(data || null);
  }, [conversationId]);

  useEffect(() => {
    load();
    if (!conversationId) return;
    const ch = supabase.channel(`seq-run-${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "zapp_sequence_runs", filter: `conversation_id=eq.${conversationId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, load]);

  if (!run) return null;

  const cancel = async () => {
    const { error } = await db.from("zapp_sequence_runs").update({ status: "cancelled", cancel_reason: "cancelado pelo usuário" }).eq("id", run.id);
    if (error) toast.error("Não foi possível cancelar"); else { toast.success("Sequência cancelada"); setRun(null); }
  };

  return (
    <div className="flex items-center gap-2 border-t border-zapp-border bg-zapp-panel-header px-4 py-2 text-xs text-zapp-text">
      <ListOrdered className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate">
        Sequência <strong>{run.sequence_name}</strong> em andamento ({run.sent_steps}/{run.total_steps}). Se você escrever aqui, ela para.
      </span>
      <Button variant="ghost" size="sm" className="h-8" onClick={cancel}><X className="mr-1 h-3.5 w-3.5" /> Cancelar</Button>
    </div>
  );
}
