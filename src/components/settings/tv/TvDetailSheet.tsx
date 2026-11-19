import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, Clock, CornerDownLeft, Home, Info,
  Link2, Loader2, Monitor, MonitorOff, Send, Tv, Undo2, Volume2,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { sendTvCommand, updateTvScreen } from "@/hooks/useTvWall";
import {
  TV_PERIODS, buildTvUrl, isYoutubePlaylist, parseTvUrl, tvCapabilities, tvContentKind, tvVisualState, type TvContentKind,
} from "@/lib/tv/tvUrl";
import { CMD_LABEL, STATE, STATUS_LABEL, describeContent, runTv } from "./tvShared";
import { isReleased } from "@/lib/tv/tvConn";
import { ReleaseButton, ReturnButton, hhmm } from "./TvConnRelease";
import { ConnectionTab } from "./TvConnectionTab";
import tvSemCaptura from "@/assets/tv-sem-captura.png.asset.json";

interface Props {
  screen: any | null; status?: any; events: any[]; commands: any[];
  dashboards: { id: string; name: string }[]; settings?: any; onOpenChange: (v: boolean) => void;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function TvDetailSheet(props: Props) {
  return (
    <Sheet open={!!props.screen} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col gap-0">
        {props.screen && <Body key={props.screen.slot} {...props} screen={props.screen} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ screen, status, events, commands, dashboards, settings }: Props & { screen: any }) {
  const caps = tvCapabilities(screen.slot);
  const state = tvVisualState(status);
  const [full, setFull] = useState(false);

  return (
    <>
      <div className="p-4 pb-3 space-y-3 border-b">
        <SheetHeader className="space-y-0.5 text-left">
          <div className="flex items-center gap-2 pr-6">
            <SheetTitle className="truncate">{screen.name}</SheetTitle>
            <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", STATE[state].cls)}>{STATE[state].label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{describeContent(screen.url, dashboards)}</p>
        </SheetHeader>
        <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
          {caps.screenshot && status?.screenshot_url ? (
            <button className="absolute inset-0" onClick={() => setFull(true)} aria-label="Abrir captura em tela cheia">
              <img src={status.screenshot_url} alt={`Tela da ${screen.name}`} className="h-full w-full object-cover" />
            </button>
          ) : !caps.screenshot ? (
            <img src={tvSemCaptura.url} alt="Esse modelo de TV não possui suporte a capturas" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground text-xs">
              <Tv className="h-7 w-7" />Sem captura ainda
            </div>
          )}
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{caps.screenshot && status?.screenshot_at ? `captura ${formatDistanceToNow(new Date(status.screenshot_at), { locale: ptBR, addSuffix: true })}` : ""}</span>
          <span>{status?.foreground_app ?? ""}{status?.ip ? ` · ${status.ip}` : ""}</span>
        </div>
        {status?.last_error && <p className="text-xs text-destructive">{status.last_error}</p>}
        {isReleased(screen) ? (
          <div className="rounded-md border bg-muted/50 p-2.5 space-y-2">
            <p className="text-xs"><span className="font-medium">Liberada até {hhmm(screen.released_until)}.</span>{" "}
              <span className="text-muted-foreground">A automação não reabre o conteúdo nem aperta teclas nesta TV. No horário de desligar ela desliga normalmente. Ao terminar ou ao devolver, volta ao conteúdo em até 30 s.</span></p>
            <ReturnButton slots={[screen.slot]} className="w-full" />
          </div>
        ) : <ReleaseButton screen={screen} settings={settings} className="w-full" />}
      </div>

      <Tabs defaultValue="conteudo" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-3 grid grid-cols-5 h-auto">
          <TabsTrigger value="conteudo" className="px-1 text-xs sm:text-sm">Conteúdo</TabsTrigger>
          <TabsTrigger value="controle" className="px-1 text-xs sm:text-sm">Controle</TabsTrigger>
          <TabsTrigger value="agenda" className="px-1 text-xs sm:text-sm">Agenda</TabsTrigger>
          <TabsTrigger value="conexao" className="px-1 text-xs sm:text-sm">Conexão</TabsTrigger>
          <TabsTrigger value="historico" className="px-1 text-xs sm:text-sm">Histórico</TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="conteudo" className="mt-0">
            {isReleased(screen) && <p className="mb-3 rounded-md border bg-muted/50 px-3 py-2 text-xs">TV liberada para uso pelo controle. Devolva para automação para trocar o conteúdo.</p>}
            <fieldset disabled={isReleased(screen)} className={cn(isReleased(screen) && "opacity-50 pointer-events-none")}><ContentTab screen={screen} dashboards={dashboards} /></fieldset>
          </TabsContent>
          <TabsContent value="controle" className="mt-0"><ControlTab screen={screen} /></TabsContent>
          <TabsContent value="agenda" className="mt-0"><AgendaTab screen={screen} /></TabsContent>
          <TabsContent value="conexao" className="mt-0"><ConnectionTab slot={screen.slot} status={status} /></TabsContent>
          <TabsContent value="historico" className="mt-0"><HistoryTab events={events} commands={commands} /></TabsContent>
        </div>
      </Tabs>

      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="max-w-6xl">
          <DialogTitle>{screen.name}</DialogTitle>
          {status?.screenshot_url && <img src={status.screenshot_url} alt={`Tela da ${screen.name}`} className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ContentTab({ screen, dashboards }: { screen: any; dashboards: { id: string; name: string }[] }) {
  const parsed = parseTvUrl(screen.url);
  const [kind, setKind] = useState<TvContentKind>(tvContentKind(screen.url));
  const [dash, setDash] = useState(parsed?.dashboardId ?? "");
  const [periodo, setPeriodo] = useState(parsed?.periodo ?? "este_mes");
  const [zoom, setZoom] = useState(parsed?.zoom ?? 100);
  const [foco, setFoco] = useState(parsed?.foco ?? true);
  const [tvFit, setTvFit] = useState(parsed?.tvFit ?? false);
  const [playlist, setPlaylist] = useState(isYoutubePlaylist(screen.url) ? screen.url : "");

  const url = useMemo(() => {
    if (kind === "playlist") return isYoutubePlaylist(playlist.trim()) ? playlist.trim() : "";
    return dash ? buildTvUrl({ dashboardId: dash, periodo, zoom, foco, tvFit }) : "";
  }, [kind, playlist, dash, periodo, zoom, foco, tvFit]);
  const invalidPlaylist = kind === "playlist" && playlist.trim() !== "" && !url;

  const save = () => runTv(() => updateTvScreen(screen.slot, kind === "playlist" ? { url, refresh_min: 0 } : { url }));

  return (
    <div className="space-y-4">
      <ToggleGroup type="single" value={kind} onValueChange={(v) => v && setKind(v as TvContentKind)} className="grid grid-cols-2 rounded-md border p-1">
        <ToggleGroupItem value="dashboard" className="h-8">Dashboard</ToggleGroupItem>
        <ToggleGroupItem value="playlist" className="h-8">Playlist do YouTube</ToggleGroupItem>
      </ToggleGroup>

      {kind === "dashboard" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-xs">Dashboard</Label>
              <Select value={dash} onValueChange={setDash}>
                <SelectTrigger><SelectValue placeholder="Escolha o painel" /></SelectTrigger>
                <SelectContent>{dashboards.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label className="text-xs">Período</Label>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TV_PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs w-20">Zoom {zoom}%</span>
            <Slider min={50} max={120} step={5} value={[zoom]} onValueChange={(v) => setZoom(v[0])} className="flex-1" />
          </div>
          <div className="flex gap-5 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={foco} onCheckedChange={(v) => setFoco(!!v)} />Modo Foco</label>
            <label className="flex items-center gap-2"><Checkbox checked={tvFit} onCheckedChange={(v) => setTvFit(!!v)} />Ajustar à TV</label>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs">Link da playlist</Label>
          <Input value={playlist} onChange={(e) => setPlaylist(e.target.value)} placeholder="https://www.youtube.com/playlist?list=…" />
          {invalidPlaylist
            ? <p className="text-xs text-destructive">O link precisa ter "list=" (link de playlist do YouTube).</p>
            : <p className="text-xs text-muted-foreground">A TV abre no app do YouTube, começando por um episódio sorteado. Não recarrega sozinha.</p>}
        </div>
      )}

      <div className="rounded-md bg-muted px-3 py-2">
        <p className="text-[11px] text-muted-foreground mb-0.5">Endereço que a TV vai abrir</p>
        <p className="text-xs font-mono break-all">{url || "—"}</p>
      </div>
      <Button className="w-full" disabled={!url || url === screen.url} onClick={save}>Salvar</Button>
    </div>
  );
}

function ControlTab({ screen }: { screen: any }) {
  const caps = tvCapabilities(screen.slot);
  const [vol, setVol] = useState<number>(screen.volume ?? 0);
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  useEffect(() => setVol(screen.volume ?? 0), [screen.volume]);
  const cmd = (c: string, payload: Record<string, unknown> = {}) => runTv(() => sendTvCommand(screen.slot, c, payload));
  const key = (k: string) => cmd("key", { keys: [k] });

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <Label className="text-xs">Som</Label>
        <div className="flex items-center gap-3">
          <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
          {caps.exactVolume ? (
            <>
              <Slider min={0} max={100} step={1} value={[vol]} onValueChange={(v) => setVol(v[0])} className="flex-1"
                onValueCommit={(v) => runTv(async () => { await updateTvScreen(screen.slot, { volume: v[0] }); await sendTvCommand(screen.slot, "volume", { level: v[0] }); })} />
              <span className="text-xs w-8 text-right">{vol}</span>
            </>
          ) : <span className="flex-1 text-xs text-muted-foreground">Volume exato indisponível nesta TV</span>}
          <label className="flex items-center gap-1.5 text-xs"><Switch checked={screen.muted}
            onCheckedChange={(v) => runTv(async () => { await updateTvScreen(screen.slot, { muted: v }); await sendTvCommand(screen.slot, v ? "mute" : "unmute"); })} />Mudo</label>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {caps.screenOff && <>
          <Button size="sm" variant="outline" onClick={() => cmd("screen_off")}><MonitorOff className="h-3.5 w-3.5 mr-1.5" />Apagar a tela</Button>
          <Button size="sm" variant="outline" onClick={() => cmd("screen_on")}><Monitor className="h-3.5 w-3.5 mr-1.5" />Acender a tela</Button>
        </>}
        <Button size="sm" variant="outline" onClick={() => cmd("pair")}><Link2 className="h-3.5 w-3.5 mr-1.5" />Repetir pareamento</Button>
      </section>

      {caps.toast && (
        <section className="space-y-1.5">
          <Label className="text-xs">Enviar aviso</Label>
          <div className="flex gap-2">
            <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Ex.: Reunião às 10h" maxLength={200} />
            <Button size="icon" variant="outline" aria-label="Enviar aviso" disabled={!msg.trim()}
              onClick={() => { cmd("toast", { message: msg.trim() }); setMsg(""); }}><Send className="h-4 w-4" /></Button>
          </div>
        </section>
      )}

      <Separator />

      <section className="space-y-2">
        <Label className="text-xs">Login na TV</Label>
        <p className="text-xs text-muted-foreground">Selecione o campo na TV antes de enviar.</p>
        <div className="flex gap-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" autoComplete="off" />
          <Button size="sm" variant="outline" disabled={!email} onClick={() => { cmd("type_text", { text: email }); setEmail(""); }}>Digitar</Button>
        </div>
        <div className="flex gap-2">
          <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Senha" autoComplete="new-password" />
          <Button size="sm" variant="outline" disabled={!pwd} onClick={() => {
            runTv(async () => { await sendTvCommand(screen.slot, "type_text", { text: pwd }); await sendTvCommand(screen.slot, "key", { keys: ["ENTER"] }); });
            setPwd("");
          }}>Digitar + Enter</Button>
        </div>
      </section>

      <section className="space-y-2">
        <Label className="text-xs">Controle remoto</Label>
        <div className="mx-auto w-fit rounded-2xl border bg-muted/40 p-3 shadow-sm">
          <div className="grid grid-cols-3 gap-1.5 place-items-center">
            <span /><Button size="icon" variant="outline" className="h-10 w-10" aria-label="Cima" onClick={() => key("UP")}><ArrowUp className="h-4 w-4" /></Button><span />
            <Button size="icon" variant="outline" className="h-10 w-10" aria-label="Esquerda" onClick={() => key("LEFT")}><ArrowLeft className="h-4 w-4" /></Button>
            <Button size="icon" className="h-11 w-11 rounded-full" aria-label="OK" onClick={() => key("ENTER")}><CornerDownLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" className="h-10 w-10" aria-label="Direita" onClick={() => key("RIGHT")}><ArrowRight className="h-4 w-4" /></Button>
            <span /><Button size="icon" variant="outline" className="h-10 w-10" aria-label="Baixo" onClick={() => key("DOWN")}><ArrowDown className="h-4 w-4" /></Button><span />
          </div>
          <div className="flex justify-center gap-6 pt-2">
            <Button size="sm" variant="ghost" onClick={() => key("BACK")}><Undo2 className="h-4 w-4 mr-1" />Voltar</Button>
            <Button size="sm" variant="ghost" onClick={() => key("HOME")}><Home className="h-4 w-4 mr-1" />Home</Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AgendaTab({ screen }: { screen: any }) {
  const save = (patch: Record<string, unknown>) => runTv(() => updateTvScreen(screen.slot, patch));
  const playlist = tvContentKind(screen.url) === "playlist";
  const days: number[] = screen.custom_days ?? [];
  return (
    <div className="space-y-4">
      <div className="space-y-1"><Label className="text-xs">Horário</Label>
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
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((l, i) => {
              const on = days.includes(i);
              return <Button key={i} size="sm" variant={on ? "default" : "outline"} className="h-8 w-11 px-0"
                onClick={() => save({ custom_days: on ? days.filter((x) => x !== i) : [...days, i].sort() })}>{l}</Button>;
            })}
          </div>
          <div className="flex gap-3">
            <div className="space-y-1"><Label className="text-xs">Liga</Label>
              <Input type="time" defaultValue={screen.custom_on_time ?? "07:50"} className="w-28" onBlur={(e) => save({ custom_on_time: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Desliga</Label>
              <Input type="time" defaultValue={screen.custom_off_time ?? "19:30"} className="w-28" onBlur={(e) => save({ custom_off_time: e.target.value })} /></div>
          </div>
        </div>
      )}
      <label className="flex items-center justify-between text-sm">Anti-proteção de tela
        <Switch checked={screen.keepalive} onCheckedChange={(v) => save({ keepalive: v })} /></label>
      <label className="flex items-center justify-between text-sm">TV habilitada
        <Switch checked={screen.enabled} onCheckedChange={(v) => save({ enabled: v })} /></label>
      <div className="space-y-1">
        <Label className="text-xs">Recarregar a cada (min, 0 = nunca)</Label>
        <Input type="number" min={0} key={`r-${screen.refresh_min}-${playlist}`} defaultValue={playlist ? 0 : screen.refresh_min} disabled={playlist} className="w-28"
          onBlur={(e) => { const n = Math.max(0, Number(e.target.value) || 0); if (n !== screen.refresh_min) save({ refresh_min: n }); }} />
        {playlist && <p className="text-xs text-muted-foreground">Travado em 0: recarregar cortaria o episódio.</p>}
      </div>
    </div>
  );
}

function HistoryTab({ events, commands }: { events: any[]; commands: any[] }) {
  const rows = [
    ...events.map((e) => ({ at: e.created_at, text: e.message ?? e.kind, kind: e.kind === "error" ? "error" : "info" })),
    ...commands.map((c) => ({
      at: c.created_at,
      text: `${CMD_LABEL[c.command] ?? c.command}${c.slot == null ? " (todas)" : ""} — ${STATUS_LABEL[c.status] ?? c.status}${c.result ? `: ${c.result}` : ""}`,
      kind: c.status === "error" ? "error" : c.status === "done" ? "done" : c.status === "taken" ? "taken" : "pending",
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
  if (!rows.length) return <p className="text-sm text-muted-foreground text-center py-8">Nada ainda.</p>;
  const Icon = { error: AlertCircle, info: Info, done: CheckCircle2, taken: Loader2, pending: Clock } as const;
  return (
    <ul className="divide-y">
      {rows.map((r, i) => {
        const I = Icon[r.kind as keyof typeof Icon];
        return (
          <li key={i} className="flex gap-2.5 py-2 text-xs">
            <I className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", r.kind === "error" ? "text-destructive" : r.kind === "done" ? "text-success" : "text-muted-foreground", r.kind === "taken" && "animate-spin")} />
            <span className={cn("flex-1", r.kind === "error" && "text-destructive")}>{r.text}</span>
            <span className="text-muted-foreground shrink-0">{new Date(r.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
          </li>
        );
      })}
    </ul>
  );
}
