import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, ChevronDown, CornerDownLeft, Home, Link2,
  Monitor, MonitorOff, Power, PowerOff, RefreshCw, Send, Undo2, Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sendTvCommand, updateTvScreen } from "@/hooks/useTvWall";
import { TV_PERIODS, buildTvUrl, parseTvUrl, tvVisualState, type TvVisualState } from "@/lib/tv/tvUrl";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const STATE: Record<TvVisualState, { label: string; cls: string }> = {
  on: { label: "Ligada", cls: "bg-success/15 text-success border-success/30" },
  saver: { label: "Proteção de tela", cls: "bg-warning/15 text-warning border-warning/30" },
  off: { label: "Desligada", cls: "bg-muted text-muted-foreground border-border" },
  nocontact: { label: "Sem contato", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  unpaired: { label: "Não pareada", cls: "bg-warning/15 text-warning border-warning/30" },
};

const CMD_LABEL: Record<string, string> = {
  on: "Ligar", off: "Desligar", reload: "Recarregar", open_url: "Abrir link", screenshot: "Capturar tela",
  wake: "Acordar", screen_off: "Apagar tela", screen_on: "Acender tela", volume: "Volume", mute: "Mudo",
  unmute: "Tirar mudo", toast: "Aviso", type_text: "Digitar texto", key: "Tecla", pair: "Parear",
};
const STATUS_LABEL: Record<string, string> = { pending: "aguardando", taken: "em execução", done: "feito", error: "erro" };

function useDashboards() {
  // Lista leve para o seletor (sem depender do provider do Insights)
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

interface Props { screen: any; status?: any; events: any[]; commands: any[] }

export function TvScreenCard({ screen, status, events, commands }: Props) {
  const { data: dashboards = [] } = useDashboards();
  const parsed = parseTvUrl(screen.url);
  const [dash, setDash] = useState(parsed?.dashboardId ?? "");
  const [periodo, setPeriodo] = useState(parsed?.periodo ?? "este_mes");
  const [zoom, setZoom] = useState(parsed?.zoom ?? 100);
  const [foco, setFoco] = useState(parsed?.foco ?? true);
  const [tvFit, setTvFit] = useState(parsed?.tvFit ?? false);
  const [manualUrl, setManualUrl] = useState(screen.url ?? "");
  const [toastMsg, setToastMsg] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => { setManualUrl(screen.url ?? ""); }, [screen.url]);

  const state = tvVisualState(status);
  const builtUrl = useMemo(() => dash ? buildTvUrl({ dashboardId: dash, periodo, zoom, foco, tvFit }) : "", [dash, periodo, zoom, foco, tvFit]);

  const run = async (fn: () => Promise<void>, ok = "Comando enviado") => {
    try { await fn(); toast.success(ok); } catch (e: any) { toast.error(e.message ?? "Erro"); }
  };
  const cmd = (c: string, payload: Record<string, unknown> = {}, ok?: string) => run(() => sendTvCommand(screen.slot, c, payload), ok);
  const save = (patch: Record<string, unknown>, ok = "Salvo") => run(() => updateTvScreen(screen.slot, patch), ok);

  return (
    <Card className={cn(!screen.enabled && "opacity-60")}>
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold truncate">{screen.slot}. {screen.name}</p>
            <Input className="h-7 mt-1 text-xs" placeholder="Local (ex.: parede, fileira de cima)" defaultValue={screen.location ?? ""}
              onBlur={(e) => e.target.value !== (screen.location ?? "") && save({ location: e.target.value || null })} />
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="outline" className={STATE[state].cls}>{STATE[state].label}</Badge>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Habilitada <Switch checked={screen.enabled} onCheckedChange={(v) => save({ enabled: v })} />
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Captura */}
        <div>
          {status?.screenshot_url ? (
            <button className="block w-full" onClick={() => setZoomOpen(true)} aria-label="Ampliar captura">
              <img src={status.screenshot_url} alt={`Tela da ${screen.name}`} className="w-full aspect-video object-cover rounded-md border" />
            </button>
          ) : (
            <div className="w-full aspect-video rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground">Sem captura</div>
          )}
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{status?.screenshot_at ? `Captura ${formatDistanceToNow(new Date(status.screenshot_at), { locale: ptBR, addSuffix: true })}` : ""}</span>
            <span>{status?.foreground_app ?? ""}{status?.ip ? ` · ${status.ip}` : ""}</span>
          </div>
          {status?.last_error && <p className="text-xs text-destructive mt-1">{status.last_error}</p>}
        </div>

        {/* Ações */}
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => cmd("screenshot")}><Camera className="h-3.5 w-3.5 mr-1" />Ver tela agora</Button>
          <Button size="sm" variant="outline" onClick={() => cmd("reload")}><RefreshCw className="h-3.5 w-3.5 mr-1" />Recarregar</Button>
          <Button size="sm" variant="outline" onClick={() => cmd("on")}><Power className="h-3.5 w-3.5 mr-1" />Ligar</Button>
          <Button size="sm" variant="outline" onClick={() => cmd("off")}><PowerOff className="h-3.5 w-3.5 mr-1" />Desligar</Button>
          <Button size="sm" variant="outline" onClick={() => cmd("screen_off")}><MonitorOff className="h-3.5 w-3.5 mr-1" />Apagar só a tela</Button>
          <Button size="sm" variant="outline" onClick={() => cmd("screen_on")}><Monitor className="h-3.5 w-3.5 mr-1" />Acender a tela</Button>
          <Button size="sm" variant="outline" onClick={() => cmd("pair")}><Link2 className="h-3.5 w-3.5 mr-1" />Repetir pareamento</Button>
        </div>

        {/* Dashboard */}
        <div className="space-y-2 rounded-md border p-3">
          <Label className="text-xs uppercase text-muted-foreground">Dashboard exibido</Label>
          <div className="grid grid-cols-2 gap-2">
            <Select value={dash} onValueChange={setDash}>
              <SelectTrigger><SelectValue placeholder="Escolha o painel" /></SelectTrigger>
              <SelectContent>{dashboards.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TV_PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs w-16">Zoom {zoom}%</span>
            <Slider min={50} max={120} step={5} value={[zoom]} onValueChange={(v) => setZoom(v[0])} className="flex-1" />
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={foco} onCheckedChange={(v) => setFoco(!!v)} />Modo Foco</label>
            <label className="flex items-center gap-2"><Checkbox checked={tvFit} onCheckedChange={(v) => setTvFit(!!v)} />Ajustar à TV</label>
          </div>
          <Button size="sm" disabled={!builtUrl} onClick={() => save({ url: builtUrl }, "Painel salvo — a TV aplica em até 30 s")}>Salvar painel</Button>
          <div className="flex gap-2 pt-1">
            <Input value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} placeholder="Ou cole uma URL" className="text-xs" />
            <Button size="sm" variant="outline" disabled={!manualUrl.startsWith("https://")} onClick={() => save({ url: manualUrl }, "URL salva")}>Salvar</Button>
          </div>
        </div>

        {/* Comportamento */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Recarregar a cada (min, 0 = nunca)</Label>
            <Input type="number" min={0} defaultValue={screen.refresh_min} onBlur={(e) => Number(e.target.value) !== screen.refresh_min && save({ refresh_min: Math.max(0, Number(e.target.value) || 0) })} /></div>
          <label className="flex items-center gap-2 text-sm pt-5"><Switch checked={screen.keepalive} onCheckedChange={(v) => save({ keepalive: v })} />Anti-proteção de tela</label>
          <div className="space-y-1 col-span-2"><Label className="text-xs">Horário</Label>
            <Select value={screen.schedule_mode} onValueChange={(v) => save({ schedule_mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Geral</SelectItem>
                <SelectItem value="custom">Próprio</SelectItem>
                <SelectItem value="always_on">Sempre ligada</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {screen.schedule_mode === "custom" && (
            <div className="col-span-2 space-y-2">
              <div className="flex flex-wrap gap-3">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((l, i) => {
                  const days: number[] = screen.custom_days ?? [];
                  return (
                    <label key={i} className="flex items-center gap-1.5 text-xs">
                      <Checkbox checked={days.includes(i)} onCheckedChange={(c) => save({ custom_days: c ? [...days, i].sort() : days.filter((x) => x !== i) })} />{l}
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Input type="time" defaultValue={screen.custom_on_time ?? "07:50"} className="w-28" onBlur={(e) => save({ custom_on_time: e.target.value })} />
                <Input type="time" defaultValue={screen.custom_off_time ?? "19:30"} className="w-28" onBlur={(e) => save({ custom_off_time: e.target.value })} />
              </div>
            </div>
          )}
          <div className="col-span-2 flex items-center gap-3">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider min={0} max={100} step={1} defaultValue={[screen.volume ?? 0]} className="flex-1"
              onValueCommit={(v) => { save({ volume: v[0] }, "Volume salvo"); sendTvCommand(screen.slot, "volume", { level: v[0] }).catch(() => {}); }} />
            <span className="text-xs w-8">{screen.volume ?? "—"}</span>
            <label className="flex items-center gap-1.5 text-xs"><Switch checked={screen.muted}
              onCheckedChange={(v) => { save({ muted: v }); sendTvCommand(screen.slot, v ? "mute" : "unmute").catch(() => {}); }} />Mudo</label>
          </div>
        </div>

        {/* Aviso */}
        <div className="flex gap-2">
          <Input value={toastMsg} onChange={(e) => setToastMsg(e.target.value)} placeholder="Aviso na TV (ex.: Reunião às 10h)" maxLength={200} />
          <Button size="sm" variant="outline" disabled={!toastMsg.trim()} onClick={() => { cmd("toast", { message: toastMsg.trim() }, "Aviso enviado"); setToastMsg(""); }}><Send className="h-3.5 w-3.5" /></Button>
        </div>

        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium">Login na TV e controle remoto <ChevronDown className="h-4 w-4" /></CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">Selecione o campo na TV antes de enviar.</p>
            <div className="flex gap-2">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" autoComplete="off" />
              <Button size="sm" variant="outline" disabled={!email} onClick={() => { cmd("type_text", { text: email }); setEmail(""); }}>Digitar e-mail</Button>
            </div>
            <div className="flex gap-2">
              <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Senha" autoComplete="new-password" />
              <Button size="sm" variant="outline" disabled={!pwd} onClick={async () => {
                await run(async () => { await sendTvCommand(screen.slot, "type_text", { text: pwd }); await sendTvCommand(screen.slot, "key", { keys: ["ENTER"] }); });
                setPwd("");
              }}>Digitar senha + Enter</Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 w-48 mx-auto">
              <span /><Button size="sm" variant="outline" aria-label="Cima" onClick={() => cmd("key", { keys: ["UP"] })}><ArrowUp className="h-4 w-4" /></Button><span />
              <Button size="sm" variant="outline" aria-label="Esquerda" onClick={() => cmd("key", { keys: ["LEFT"] })}><ArrowLeft className="h-4 w-4" /></Button>
              <Button size="sm" aria-label="OK" onClick={() => cmd("key", { keys: ["ENTER"] })}><CornerDownLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" aria-label="Direita" onClick={() => cmd("key", { keys: ["RIGHT"] })}><ArrowRight className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" aria-label="Voltar" onClick={() => cmd("key", { keys: ["BACK"] })}><Undo2 className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" aria-label="Baixo" onClick={() => cmd("key", { keys: ["DOWN"] })}><ArrowDown className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" aria-label="Home" onClick={() => cmd("key", { keys: ["HOME"] })}><Home className="h-4 w-4" /></Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium">Histórico <ChevronDown className="h-4 w-4" /></CollapsibleTrigger>
          <CollapsibleContent className="pt-2 max-h-64 overflow-y-auto space-y-1 text-xs">
            {[...events.map((e) => ({ at: e.created_at, text: `${e.kind}: ${e.message ?? ""}`, err: e.kind === "error" })),
              ...commands.map((c) => ({
                at: c.created_at,
                text: `${CMD_LABEL[c.command] ?? c.command}${c.slot == null ? " (todas)" : ""} — ${STATUS_LABEL[c.status] ?? c.status}${c.result ? `: ${c.result}` : ""}`,
                err: c.status === "error",
              }))]
              .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25)
              .map((r, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">{new Date(r.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className={cn(r.err && "text-destructive")}>{r.text}</span>
                </div>
              ))}
            {events.length + commands.length === 0 && <p className="text-muted-foreground">Nada ainda.</p>}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-5xl">
          <DialogTitle>{screen.name}</DialogTitle>
          {status?.screenshot_url && <img src={status.screenshot_url} alt={`Tela da ${screen.name}`} className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
