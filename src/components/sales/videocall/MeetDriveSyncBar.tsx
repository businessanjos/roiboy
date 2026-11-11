import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Cloud, Loader2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { startGoogleDriveOAuth, getGoogleDriveOAuthErrorMessage, getGoogleDriveCallbackMessage } from "@/lib/googleDriveOAuth";

interface Conn {
  id: string;
  google_email: string | null;
  scope: string | null;
  last_sync_at: string | null;
  last_sync_error: string | null;
  is_active: boolean;
}

/** Cada vendedor conecta o próprio Google para as transcrições do Meet entrarem sozinhas. */
export function MeetDriveSyncBar({ onSynced }: { onSynced?: () => void }) {
  const [conn, setConn] = useState<Conn | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();

  const load = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setLoading(false);
    const { data } = await supabase
      .from("google_drive_connections")
      .select("id, google_email, scope, last_sync_at, last_sync_error, is_active")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    setConn((data as Conn) ?? null);
    setLoading(false);
  };

  const sync = async (silent = false) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gdrive-sync-meet-transcripts", { body: {} });
    setBusy(false);
    await load();
    const r = data?.results?.[0];
    if (error || r?.error) {
      if (!silent) toast.error(r?.error ? "Não consegui ler o Drive. Veja o aviso acima." : "Falha ao sincronizar");
      return;
    }
    if (!silent) toast.success(r?.imported ? `${r.imported} call(s) nova(s) do Meet` : "Nenhuma transcrição nova");
    if (r?.imported) onSynced?.();
  };

  useEffect(() => {
    load();
    const s = params.get("gdrive");
    if (s) {
      if (s === "connected") { toast.success("Google conectado! Buscando suas transcrições…"); sync(true).then(() => onSynced?.()); }
      else toast.error(getGoogleDriveCallbackMessage(params.get("reason")));
      const n = new URLSearchParams(params); n.delete("gdrive"); n.delete("reason");
      setParams(n, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setBusy(true);
    try { await startGoogleDriveOAuth(); }
    catch (e) { toast.error(getGoogleDriveOAuthErrorMessage(e)); setBusy(false); }
  };

  if (loading) return null;
  const hasDrive = !!conn?.is_active && !!conn.scope?.includes("drive");
  const needsFix = !!conn && (!hasDrive || /reconect|insufficient|403/i.test(conn.last_sync_error ?? ""));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Cloud className="h-4 w-4" /></div>
        <div className="min-w-0 text-sm">
          {!conn ? (
            <>
              <p className="font-medium">Transcrições do Google Meet automáticas</p>
              <p className="text-muted-foreground">Conecte seu Google uma vez. Toda call do Meet com transcrição ligada aparece aqui sozinha.</p>
            </>
          ) : needsFix ? (
            <>
              <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-3.5 w-3.5 text-destructive" />Falta liberar o Drive</p>
              <p className="text-muted-foreground">Reconecte e marque a caixa de acesso ao Google Drive na tela do Google.</p>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1.5 font-medium"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />Meet conectado · {conn.google_email}</p>
              <p className="text-muted-foreground">
                {conn.last_sync_at ? `Última busca ${formatDistanceToNow(new Date(conn.last_sync_at), { addSuffix: true, locale: ptBR })}` : "Aguardando primeira busca"}
                {" · "}busca automática a cada hora
              </p>
            </>
          )}
        </div>
      </div>
      {!conn || needsFix ? (
        <Button size="sm" onClick={connect} disabled={busy} className="gap-1.5">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
          {conn ? "Reconectar Google" : "Conectar Google"}
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => sync()} disabled={busy} className="gap-1.5">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Buscar agora
        </Button>
      )}
    </div>
  );
}
