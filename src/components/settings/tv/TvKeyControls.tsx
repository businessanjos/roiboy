import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { runTv } from "./tvShared";

const db = supabase as any;
const fmt = (v: string | null) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca");

/** TV key: lets Insights dashboards open on this TV without login. The key itself is never shown. */
export function TvKeyControls({ slot }: { slot: number }) {
  const qc = useQueryClient();
  const { data: key, isLoading } = useQuery({
    queryKey: ["tv-key", slot],
    queryFn: async () => (await db.from("tv_screen_tokens").select("slot,created_at,last_used_at").eq("slot", slot).maybeSingle()).data as { created_at: string; last_used_at: string | null } | null,
  });
  const call = (action: "issue" | "revoke", msg: string) => runTv(async () => {
    const { error, data } = await supabase.functions.invoke("tv-token", { body: { slot, action } });
    if (error || data?.error) throw new Error(data?.error || error?.message);
    await qc.invalidateQueries({ queryKey: ["tv-key", slot] });
  }, msg);
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="flex items-center gap-2 text-sm font-medium"><KeyRound className="h-4 w-4 text-primary" />Chave de TV</p>
      <p className="text-xs text-muted-foreground">Abre os painéis de Insights nesta TV sem login, só para ver. O Roy coloca a chave no link sozinho; ela não aparece aqui.</p>
      {isLoading ? null : key ? (
        <>
          <p className="text-xs">Criada em {fmt(key.created_at)} · Último uso: {fmt(key.last_used_at)}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => call("issue", "Nova chave gerada — a anterior parou de funcionar")}>Gerar nova chave</Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => call("revoke", "Chave cancelada")}>Cancelar chave</Button>
          </div>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={() => call("issue", "Chave gerada")}>Gerar chave</Button>
      )}
    </div>
  );
}
