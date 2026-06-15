import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";

type Platform = "instagram" | "tiktok" | "youtube" | "whatsapp";

interface Props {
  platform: Platform;
  visibleCount: number;
  onReload?: () => void;
}

const LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
};

const TOTAL_KEY: Record<Platform, string> = {
  instagram: "instagram_total",
  tiktok: "tiktok_total",
  youtube: "youtube_total",
  whatsapp: "whatsapp_total",
};

export function IntegrationAccessAlert({ platform, visibleCount, onReload }: Props) {
  const [checking, setChecking] = useState(true);
  const [total, setTotal] = useState<number>(0);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setChecking(true);
      const { data, error } = await supabase.rpc("check_integration_access");
      if (cancelled) return;
      if (error) {
        console.error("[IntegrationAccessAlert] check error:", error);
        setChecking(false);
        return;
      }
      const t = Number((data as any)?.[TOTAL_KEY[platform]] ?? 0);
      setTotal(t);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [platform]);

  const handleRequest = async () => {
    setRequesting(true);
    const { data, error } = await supabase.rpc("request_integration_access", {
      _platform: LABELS[platform],
      _reason: `Não consigo visualizar as conexões de ${LABELS[platform]} configuradas na conta.`,
    });
    setRequesting(false);
    if (error) {
      toast.error("Erro ao enviar pedido de acesso");
      return;
    }
    const notified = (data as any)?.notified ?? 0;
    if (notified > 0) {
      toast.success(`Pedido enviado para ${notified} administrador(es)`);
    } else {
      toast.message("Nenhum administrador encontrado para notificar");
    }
    setRequested(true);
  };

  if (checking) {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>Verificando suas permissões…</AlertDescription>
      </Alert>
    );
  }

  const missing = total > visibleCount;
  if (!missing) return null;

  const hidden = total - visibleCount;

  return (
    <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
      <ShieldAlert className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-300">
        Você não está vendo todas as conexões de {LABELS[platform]}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm">
          Existem <strong>{total}</strong> conexão(ões) cadastrada(s) nesta conta, mas você só
          consegue ver <strong>{visibleCount}</strong>. Isso geralmente é causado por
          restrições de permissão.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onReload?.();
              window.location.reload();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Recarregar página
          </Button>
          <Button
            size="sm"
            onClick={handleRequest}
            disabled={requesting || requested}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {requesting ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            )}
            {requested ? "Pedido enviado" : "Solicitar acesso ao admin"}
          </Button>
          <span className="text-xs text-muted-foreground self-center">
            {hidden} conexão(ões) ocultas por permissão
          </span>
        </div>
      </AlertDescription>
    </Alert>
  );
}
