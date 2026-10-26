import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDealMerge } from "@/hooks/useDealMerge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function UndoDealMergeButton({ dealId, onRestored }: { dealId: string; onRestored: () => void }) {
  const { currentUser } = useCurrentUser();
  const { undoMerge } = useDealMerge();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: action } = useQuery({
    queryKey: ["last-deal-merge", currentUser?.auth_user_id, dealId],
    enabled: Boolean(currentUser?.auth_user_id),
    queryFn: async () => {
      if (!currentUser?.auth_user_id) return null;
      const { data, error } = await supabase.from("deal_merge_actions").select("id,created_at")
        .eq("target_deal_id", dealId).eq("actor_id", currentUser.auth_user_id).is("undone_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (!action) return null;
  return <>
    <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><RotateCcw className="h-4 w-4 mr-1" />Desfazer mesclagem</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Desfazer mesclagem?</DialogTitle>
          <DialogDescription>Os dois negócios voltarão a ficar separados, cada um com seu lead, atividades e dados anteriores. Se houver alterações posteriores, a ação será bloqueada para não perder informações.</DialogDescription>
        </DialogHeader>
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={busy} onClick={async () => {
            setBusy(true);
            try { if (await undoMerge(action.id)) { setOpen(false); onRestored(); } }
            finally { setBusy(false); }
          }}>{busy ? "Desfazendo…" : "Desfazer mesclagem"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}