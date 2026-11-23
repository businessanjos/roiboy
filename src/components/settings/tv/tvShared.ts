import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { describeTraffic, parseTrafficUrl } from "@/lib/tv/trafficHub";
import { TV_PERIODS, parseTvUrl, playlistLabel, tvContentKind, type TvVisualState } from "@/lib/tv/tvUrl";

export const STATE: Record<TvVisualState, { label: string; cls: string }> = {
  on: { label: "Ligada", cls: "bg-success-soft text-success-strong border-success/40 font-semibold shadow-sm" },
  saver: { label: "Tela de descanso", cls: "bg-warning text-warning-foreground border-transparent" },
  off: { label: "Desligada", cls: "bg-muted text-muted-foreground border-border" },
  nocontact: { label: "Sem contato", cls: "bg-destructive text-destructive-foreground border-transparent" },
  unpaired: { label: "Não conectada", cls: "bg-background/90 text-foreground border-foreground/40" },
};

export const CMD_LABEL: Record<string, string> = {
  on: "Ligar", off: "Desligar", reload: "Recarregar", open_url: "Abrir link", screenshot: "Capturar tela",
  wake: "Acordar", screen_off: "Apagar tela", screen_on: "Acender tela", volume: "Volume", mute: "Sem som",
  unmute: "Com som", toast: "Mensagem", type_text: "Digitar texto", key: "Tecla", pair: "Parear",
};
export const STATUS_LABEL: Record<string, string> = { pending: "aguardando", taken: "em execução", done: "feito", error: "erro" };

export function useTvDashboards() {
  return useQuery({
    queryKey: ["tv-insights-dashboards"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("insights_dashboards").select("id,name").eq("sector", "vendas")
        .order("display_order", { ascending: true });
      return (data ?? []) as { id: string; name: string }[];
    },
    staleTime: 5 * 60_000,
  });
}

export function describeContent(url: string | null, dashboards: { id: string; name: string }[], agencies?: { name: string; id: string }[]) {
  if (!url) return "Tela de descanso";
  if (tvContentKind(url) === "playlist") return playlistLabel(url);
  if (tvContentKind(url) === "image") return "Imagem";
  const t = parseTrafficUrl(url, agencies);
  if (t) return describeTraffic(t, agencies);
  const p = parseTvUrl(url);
  if (!p) return "Link personalizado";
  const name = dashboards.find((d) => d.id === p.dashboardId)?.name ?? "Dashboard";
  const per = TV_PERIODS.find((x) => x.value === p.periodo)?.label;
  return per ? `${name} · ${per}` : name;
}

export const SENT = "Enviado. A TV atualiza em instantes.";
export const STATE_HINT: Partial<Record<TvVisualState, string>> = {
  nocontact: "O computador do escritório não está conseguindo falar com esta TV.",
};
export async function runTv(fn: () => Promise<void>, ok = SENT) {
  try { await fn(); if (ok) toast.success(ok); } catch (e: any) { toast.error(e?.message ?? "Erro"); }
}
