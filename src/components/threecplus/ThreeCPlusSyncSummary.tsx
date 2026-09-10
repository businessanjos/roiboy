import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, RefreshCw } from "lucide-react";

export function ThreeCPlusSyncSummary() {
  const { currentUser } = useCurrentUser();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [calls, setCalls] = useState<number>(0);

  useEffect(() => {
    if (!currentUser?.account_id) return;
    supabase
      .from("threecplus_sync_state")
      .select("last_synced_at, calls_synced")
      .eq("account_id", currentUser.account_id)
      .maybeSingle()
      .then(({ data }) => {
        setLastSync((data as any)?.last_synced_at ?? null);
        setCalls((data as any)?.calls_synced ?? 0);
      });
  }, [currentUser?.account_id]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5" />
        {lastSync
          ? `Última sincronização com a 3C Plus em ${format(new Date(lastSync), "dd/MM/yyyy HH:mm", { locale: ptBR })} · ${calls} ligações importadas`
          : "Nenhuma sincronização com a 3C Plus ainda"}
      </p>
      <Button variant="outline" size="sm" asChild>
        <Link to="/settings?tab=integrations">
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Configurar 3C Plus
        </Link>
      </Button>
    </div>
  );
}
