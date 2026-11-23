import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Shows when the dedicated TV account can no longer sign in (TVs with key show the same notice). */
export function TvAccountAlert() {
  const { data } = useQuery({
    queryKey: ["tv-proxy-status"],
    queryFn: async () => (await (supabase as any).rpc("tv_proxy_status")).data?.[0] ?? null,
    refetchInterval: 60_000,
  });
  if (data?.status !== "login_failed") return null;
  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span><b>Conta de TV sem acesso</b> — as TVs com chave não abrem os painéis. A conta "TV Escritório" teve o login recusado (senha trocada ou conta bloqueada).</span>
    </div>
  );
}
