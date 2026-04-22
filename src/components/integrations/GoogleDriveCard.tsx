import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2, LogOut, Cloud, ExternalLink, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DriveConnection {
  id: string;
  google_email: string;
  connected_at: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  is_active: boolean;
  scope: string | null;
}

export function GoogleDriveCard() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connection, setConnection] = useState<DriveConnection | null>(null);

  const fetchConnection = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("google_drive_connections")
      .select("id, google_email, connected_at, last_sync_at, last_sync_status, last_sync_error, is_active, scope")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar conexão", error);
    }
    setConnection((data as DriveConnection) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    fetchConnection();
  }, []);

  // Lida com retorno do callback OAuth
  useEffect(() => {
    const status = searchParams.get("gdrive");
    if (!status) return;
    if (status === "connected") {
      toast({
        title: "Google Drive conectado!",
        description: "Sua conta foi vinculada com sucesso.",
      });
      fetchConnection();
    } else if (status === "error") {
      const reason = searchParams.get("reason") || "desconhecido";
      toast({
        title: "Falha ao conectar Google Drive",
        description: `Motivo: ${reason}`,
        variant: "destructive",
      });
    }
    const next = new URLSearchParams(searchParams);
    next.delete("gdrive");
    next.delete("reason");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, toast]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      const { data, error } = await supabase.functions.invoke("gdrive-oauth-init", {
        body: { return_to: returnTo, origin: window.location.origin },
      });
      if (error) throw error;
      if (!data?.authorize_url) throw new Error("URL de autorização não recebida.");
      window.location.href = data.authorize_url as string;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast({ title: "Erro ao iniciar conexão", description: msg, variant: "destructive" });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar a conta Google Drive? As pastas vinculadas serão removidas.")) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("gdrive-disconnect");
      if (error) throw error;
      toast({ title: "Desconectado", description: "Conta Google Drive desvinculada." });
      setConnection(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast({ title: "Erro ao desconectar", description: msg, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = !!connection?.is_active;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Google Drive
                {loading ? (
                  <Badge variant="outline" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Carregando
                  </Badge>
                ) : isConnected ? (
                  <Badge className="gap-1" variant="secondary">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <XCircle className="h-3 w-3" /> Desconectado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Sincronize transcrições de calls (.docx) automaticamente das suas pastas do Drive — Meu Drive ou Drives compartilhados.
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchConnection}
            disabled={loading}
            title="Atualizar status"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && connection ? (
          <>
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Conta Google</span>
                <span className="font-medium">{connection.google_email}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Conectado</span>
                <span>
                  {formatDistanceToNow(new Date(connection.connected_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Último sync</span>
                <span>
                  {connection.last_sync_at
                    ? formatDistanceToNow(new Date(connection.last_sync_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })
                    : "Aguardando primeira sincronização"}
                </span>
              </div>
              {connection.last_sync_status && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Status</span>
                  <span>{connection.last_sync_status}</span>
                </div>
              )}
            </div>

            {connection.last_sync_error && (
              <Alert variant="destructive">
                <AlertTitle>Erro no último sync</AlertTitle>
                <AlertDescription className="text-xs">{connection.last_sync_error}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertTitle>Próximo passo</AlertTitle>
              <AlertDescription>
                Vincule as pastas que contêm as transcrições (uma por vendedor). O painel de gestão de pastas será habilitado a seguir.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="gap-2"
              >
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Desconectar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground space-y-2">
              <p>
                Ao conectar, autorizamos o sistema a <strong>ler</strong> as pastas que você
                escolher (sem permissão de escrita). Você pode revogar o acesso a qualquer momento.
              </p>
              <p className="text-xs">
                Escopo solicitado:{" "}
                <code className="rounded bg-muted px-1 py-0.5">drive.readonly</code>
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"
              >
                Gerenciar permissões na sua conta Google
                <ExternalLink className="h-3 w-3" />
              </a>
              <Button onClick={handleConnect} disabled={connecting} className="gap-2">
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Cloud className="h-4 w-4" />
                )}
                Conectar Google
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}