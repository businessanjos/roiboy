import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, Clock, CornerDownLeft, Home, Info,
  Link2, PowerOff, Power, RefreshCw, Camera, Unlock, Maximize2, Copy, X, Loader2, Monitor, MonitorOff, Send, Tv, Undo2, Volume2,
  Cast,
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
import { CMD_LABEL, STATE, STATE_HINT, STATUS_LABEL, describeContent, runTv } from "./tvShared";
import { isReleased } from "@/lib/tv/tvConn";
import { Hint, ReleaseMenu, ReturnButton, SignalWithTip, TV_HINTS, hhmm } from "./TvConnRelease";
import { ConnectionTab } from "./TvConnectionTab";
import tvSemCaptura from "@/assets/tv-sem-captura.png.asset.json";

interface Props {
  screen: any | null; status?: any; events: any[]; commands: any[];
  dashboards: { id: string; name: string }[]; settings?: any; onOpenChange: (v: boolean) => void;
}

function Help({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground leading-snug">{children}</p>;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function HeadAction({ label, onClick, children }: { label: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Button size="sm" variant="outline" className="h-10 gap-1.5 px-3 text-xs" onClick={onClick} aria-label={label}>{children}</Button>
  );
}

export function TvDetailSheet(props: Props) {
  return (
    <Sheet open={!!props.screen} onOpenChange={props.onOpenChange}>
      <SheetContent className="w-full max-w-none sm:w-[480px] sm:max-w-[92vw] p-0 gap-0 overflow-hidden flex flex-col duration-200 [&>button:last-child]:hidden">
        {props.screen && <Body key={props.screen.slot} {...props} screen={props.screen} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({ screen, status, events, commands, dashboards, settings, onOpenChange }: Props & { screen: any }) {
  const caps = tvCapabilities(screen.slot);
  const state = tvVisualState(status);
  const isOn = state === "on" || state === "saver";
  const released = isReleased(screen);
  const [full, setFull] = useState(false);
  const cmd = (c: string) => runTv(() => sendTvCommand(screen.slot, c));
  const kind = tvContentKind(screen.url);
  const playing = !screen.url ? "Tela de descanso" : kind === "playlist" ? describeContent(screen.url, dashboards) : `Dashboard · ${describeContent(screen.url, dashboards)}`;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur px-5 pt-5 pb-4 space-y-3">
        <SheetHeader className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-lg font-semibold truncate">{screen.name}</SheetTitle>
            {STATE_HINT[state]
              ? <Hint text={STATE_HINT[state]!} side="bottom"><Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 shrink-0", STATE[state].cls)}>{STATE[state].label}</Badge></Hint>
              : <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 shrink-0", STATE[state].cls)}>{STATE[state].label}</Badge>}
            <SignalWithTip status={status} />
            <Button size="icon" variant="ghost" className="ml-auto h-10 w-10 shrink-0 -mr-2" aria-label="Fechar" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></Button>
          </div>
          <p className="text-sm text-muted-foreground truncate">{playing}</p>
        </SheetHeader>
        <div className="flex flex-wrap gap-2">
          <HeadAction label="Atualizar a página" onClick={() => cmd("reload")}><RefreshCw className="h-3.5 w-3.5" />Atualizar</HeadAction>
          {caps.screenshot && <HeadAction label="Ver a tela agora" onClick={() => cmd("screenshot")}><Camera className="h-3.5 w-3.5" />Ver tela</HeadAction>}
          <HeadAction label={isOn ? "Desligar a TV" : "Ligar a TV"} onClick={() => cmd(isOn ? "off" : "on")}>
            {isOn ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}{isOn ? "Desligar" : "Ligar"}
          </HeadAction>
          {released
            ? <ReturnButton slots={[screen.slot]} className="h-10 text-xs" hintSide="bottom" />
            : <Hint text={TV_HINTS.releaseOne} side="bottom"><ReleaseMenu screens={[screen]} settings={settings}>
                <Button size="sm" variant="outline" className="h-10 gap-1.5 px-3 text-xs"><Unlock className="h-3.5 w-3.5" />Liberar TV</Button>
              </ReleaseMenu></Hint>}
        </div>
        {released && (
          <p className="text-xs text-muted-foreground leading-snug"><span className="font-medium text-foreground">Liberada até {hhmm(screen.released_until)}.</span> A automação não troca o conteúdo nesta TV; no horário de desligar ela desliga normalmente.</p>
        )}
      </header>

      <div className="px-5 pt-5">
        <div className="relative aspect-video rounded-xl overflow-hidden border bg-muted shadow-sm">
          {caps.screenshot && status?.screenshot_url ? (
            <img src={status.screenshot_url} alt={`Tela da ${screen.name}`} className="h-full w-full object-cover" />
          ) : !caps.screenshot ? (
            <img src={tvSemCaptura.url} alt="Esse modelo de TV não possui suporte a capturas" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <div className="rounded-full bg-background/70 p-3"><Tv className="h-6 w-6" /></div>
              <span className="text-xs">Sem captura nesta TV</span>
            </div>
          )}
          {caps.screenshot && status?.screenshot_url && (
            <div className="absolute inset-x-2 bottom-2 flex items-center justify-between">
              <span className="rounded-md bg-background/80 backdrop-blur px-2 py-1 text-[11px] text-foreground">
                {status.screenshot_at ? formatDistanceToNow(new Date(status.screenshot_at), { locale: ptBR, addSuffix: true }) : ""}
              </span>
              <Button size="icon" variant="secondary" className="h-10 w-10 bg-background/80 backdrop-blur hover:bg-background" aria-label="Abrir captura em tela cheia" onClick={() => setFull(true)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        {status?.last_error && <p className="mt-2 text-xs text-destructive">{status.last_error}</p>}
      </div>

      <Tabs defaultValue="conteudo" className="pt-5">
        <div className="relative px-5">
          <TabsList className="h-11 w-full justify-start gap-1 overflow-x-auto overflow-y-hidden rounded-lg bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] sm:[mask-image:none]">
            {[["conteudo", "Conteúdo"], ["controle", "Controle"], ["horario", "Horário"], ["conexao", "Conexão"], ["historico", "Histórico"]].map(([v, l]) => (
              <TabsTrigger key={v} value={v} className="h-9 flex-1 shrink-0 whitespace-nowrap px-3 text-sm text-muted-foreground transition-all duration-150 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">{l}</TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="conteudo" className="mt-0 animate-in fade-in-0 duration-200">
          {status?.casting && kind !== "playlist" && <p className="mx-5 mt-5 flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs"><Cast className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />Esta TV está recebendo uma transmissão. A automação volta sozinha quando a transmissão acabar.</p>}
          {released && <p className="mx-5 mt-5 rounded-md border bg-muted/50 px-3 py-2 text-xs">TV liberada para uso pelo controle. Devolva para automação para trocar o conteúdo.</p>}
          <fieldset disabled={released} className={cn("min-w-0", released && "opacity-50 pointer-events-none")}><ContentTab screen={screen} status={status} dashboards={dashboards} /></fieldset>
        </TabsContent>
        <TabsContent value="controle" className="mt-0 px-5 py-6 animate-in fade-in-0 duration-200"><ControlTab screen={screen} /></TabsContent>
        <TabsContent value="horario" className="mt-0 px-5 py-6 animate-in fade-in-0 duration-200"><AgendaTab screen={screen} settings={settings} /></TabsContent>
        <TabsContent value="conexao" className="mt-0 px-5 py-6 animate-in fade-in-0 duration-200"><ConnectionTab slot={screen.slot} status={status} /></TabsContent>
        <TabsContent value="historico" className="mt-0 px-5 py-6 animate-in fade-in-0 duration-200"><HistoryTab events={events} commands={commands} /></TabsContent>
      </Tabs>

      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="max-w-6xl">
          <DialogTitle>{screen.name}</DialogTitle>
          {status?.screenshot_url && <img src={status.screenshot_url} alt={`Tela da ${screen.name}`} className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ZOOM_TICKS = [50, 75, 100, 120];

function ContentTab({ screen, status, dashboards }: { screen: any; status?: any; dashboards: { id: string; name: string }[] }) {
  const parsed = parseTvUrl(screen.url);
  const init = () => ({
    kind: tvContentKind(screen.url) as TvContentKind, dash: parsed?.dashboardId ?? "", periodo: parsed?.periodo ?? "este_mes",
    zoom: parsed?.zoom ?? 100, foco: parsed?.foco ?? true, tvFit: parsed?.tvFit ?? false, playlist: isYoutubePlaylist(screen.url) ? screen.url : "",
  });
  const [f, setF] = useState(init);
  const set = <K extends keyof ReturnType<typeof init>>(k: K, v: ReturnType<typeof init>[K]) => setF((x) => ({ ...x, [k]: v }));
  const [sentAt, setSentAt] = useState<number | null>(null);

  const toUrl = (x: ReturnType<typeof init>) => {
    if (x.kind === "playlist") return isYoutubePlaylist(x.playlist.trim()) ? x.playlist.trim() : "";
    return x.dash ? buildTvUrl({ dashboardId: x.dash, periodo: x.periodo, zoom: x.zoom, foco: x.foco, tvFit: x.tvFit }) : "";
  };
  const url = useMemo(() => toUrl(f), [f]);
  // Endereço equivalente ao salvo, montado do mesmo jeito (o salvo pode ter outra ordem de parâmetros).
  const savedUrl = useMemo(() => toUrl(init()), [screen.url]);
  const invalidPlaylist = f.kind === "playlist" && f.playlist.trim() !== "" && !url;
  const dirty = !!url && url !== screen.url && url !== savedUrl;
  const changed = JSON.stringify(f) !== JSON.stringify(init());
  // O agente lê a configuração no próximo contato; um contato depois do envio = aplicado.
  const applied = sentAt != null && !dirty && status?.last_seen && new Date(status.last_seen).getTime() > sentAt;

  const save = () => runTv(async () => {
    await updateTvScreen(screen.slot, f.kind === "playlist" ? { url, refresh_min: 0 } : { url });
    setSentAt(Date.now());
  });
  const copy = () => navigator.clipboard.writeText(url).then(() => toast.success("Endereço copiado"));

  return (
    <div>
      <div className="space-y-7 px-5 py-6">
        <Section title="Mostrar">
          <ToggleGroup type="single" value={f.kind} onValueChange={(v) => v && set("kind", v as TvContentKind)} className="grid grid-cols-2 rounded-lg bg-muted p-1">
            <ToggleGroupItem value="dashboard" className="h-10 data-[state=on]:bg-background data-[state=on]:shadow-sm">Dashboard</ToggleGroupItem>
            <ToggleGroupItem value="playlist" className="h-10 data-[state=on]:bg-background data-[state=on]:shadow-sm">Vídeos do YouTube</ToggleGroupItem>
          </ToggleGroup>
        </Section>

        {f.kind === "dashboard" ? (
          <>
            <Section title="Painel">
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Dashboard</Label>
                  <Select value={f.dash} onValueChange={(v) => set("dash", v)}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Escolha o painel" /></SelectTrigger>
                    <SelectContent>{dashboards.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="space-y-1.5"><Label className="text-xs">Período</Label>
                  <Select value={f.periodo} onValueChange={(v) => set("periodo", v)}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>{TV_PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
            </Section>

            <Section title="Tamanho">
              <div className="space-y-1.5">
                <div className="flex items-center gap-4">
                  <Slider min={50} max={120} step={5} value={[f.zoom]} onValueChange={(v) => set("zoom", v[0])} className="flex-1" aria-label="Zoom" />
                  <span className="w-12 text-right text-sm font-medium tabular-nums">{f.zoom}%</span>
                </div>
                <div className="relative mr-16 h-4 text-[10px] text-muted-foreground">
                  {ZOOM_TICKS.map((t) => (
                    <span key={t} className="absolute -translate-x-1/2" style={{ left: `${((t - 50) / 70) * 100}%` }}>{t}</span>
                  ))}
                </div>
                <Help>Diminua se o dashboard estiver cortado na TV.</Help>
              </div>
              <div className="space-y-4 pt-1">
                <label className="flex items-start justify-between gap-4">
                  <span className="space-y-0.5"><span className="block text-sm">Modo Foco</span><Help>Esconde menus e deixa só o dashboard na tela.</Help></span>
                  <Switch checked={f.foco} onCheckedChange={(v) => set("foco", v)} />
                </label>
                <label className="flex items-start justify-between gap-4">
                  <span className="space-y-0.5"><span className="block text-sm">Ajustar à TV</span><Help>Encaixa o dashboard no tamanho da tela da TV.</Help></span>
                  <Switch checked={f.tvFit} onCheckedChange={(v) => set("tvFit", v)} />
                </label>
              </div>
            </Section>
          </>
        ) : (
          <Section title="Playlist">
            <div className="space-y-1.5">
              <Label className="text-xs">Link da playlist</Label>
              <Input className="h-10" value={f.playlist} onChange={(e) => set("playlist", e.target.value)} placeholder="https://www.youtube.com/playlist?list=…" />
              {invalidPlaylist
                ? <p className="text-xs text-destructive">O link precisa ter "list=" (link de playlist do YouTube).</p>
                : <Help>Cole o link de uma playlist do YouTube. A TV começa por um vídeo sorteado e segue a lista.</Help>}
            </div>
          </Section>
        )}

        {url && (
          <Section title="Endereço que a TV vai abrir">
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 pl-3">
              <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground" title={url}>{url}</span>
              <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" aria-label="Copiar endereço" onClick={copy}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          </Section>
        )}
      </div>

      <div className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur px-5 py-4 space-y-2">
        <div className="flex items-center gap-2">
          <Button className="h-11 flex-1 disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground" disabled={!dirty} onClick={save}>Aplicar na TV</Button>
          {changed && <Button variant="ghost" className="h-11" onClick={() => setF(init())}>Descartar</Button>}
        </div>
        {sentAt != null && !dirty && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            {applied ? <><CheckCircle2 className="h-3.5 w-3.5 text-success" />Aplicado</> : <><Loader2 className="h-3.5 w-3.5 animate-spin" />Enviado · a TV atualiza em até 30 s</>}
          </p>
        )}
      </div>
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
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tela e som</h3>
        {caps.screenOff && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => cmd("screen_off")}><MonitorOff className="h-3.5 w-3.5 mr-1.5" />Apagar a tela</Button>
              <Button size="sm" variant="outline" onClick={() => cmd("screen_on")}><Monitor className="h-3.5 w-3.5 mr-1.5" />Acender a tela</Button>
            </div>
            <Help>Apaga só a imagem; a TV continua ligada e volta na hora. Bom para o almoço ou reuniões.</Help>
          </div>
        )}
        <div className="space-y-1.5">
          <Button size="sm" variant="outline" onClick={() => cmd("off")}><PowerOff className="h-3.5 w-3.5 mr-1.5" />Desligar</Button>
          <Help>Desliga a TV de verdade. Ela volta a ligar sozinha no próximo horário.</Help>
        </div>
        <div className="flex items-center gap-3">
          <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
          {caps.exactVolume ? (
            <>
              <Slider min={0} max={100} step={1} value={[vol]} onValueChange={(v) => setVol(v[0])} className="flex-1" aria-label="Volume"
                onValueCommit={(v) => runTv(async () => { await updateTvScreen(screen.slot, { volume: v[0] }); await sendTvCommand(screen.slot, "volume", { level: v[0] }); })} />
              <span className="text-xs w-8 text-right">{vol}</span>
            </>
          ) : <span className="flex-1 text-xs text-muted-foreground">Esta TV não permite escolher o volume exato.</span>}
          <label className="flex items-center gap-1.5 text-xs"><Switch checked={screen.muted}
            onCheckedChange={(v) => runTv(async () => { await updateTvScreen(screen.slot, { muted: v }); await sendTvCommand(screen.slot, v ? "mute" : "unmute"); })} />Sem som</label>
        </div>
      </section>

      {caps.toast && (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mensagem na tela</h3>
            <Label className="text-xs">Mostrar mensagem</Label>
            <div className="flex gap-2">
              <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Ex.: Reunião geral às 10h" maxLength={200} />
              <Button size="icon" variant="outline" aria-label="Mostrar mensagem" disabled={!msg.trim()}
                onClick={() => { cmd("toast", { message: msg.trim() }); setMsg(""); }}><Send className="h-4 w-4" /></Button>
            </div>
            <Help>Aparece por alguns segundos no canto da TV, sem interromper o que está passando.</Help>
          </section>
        </>
      )}

      <Separator />

      <section className="space-y-3">
        <div className="space-y-0.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Controle remoto</h3>
          <Help>Funciona como o controle físico. Use para navegar na TV quando precisar.</Help>
        </div>
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

        <div className="space-y-2 rounded-md border p-3">
          <Label className="text-xs">Entrar no Roy pela TV</Label>
          <ol className="list-decimal pl-4 text-xs text-muted-foreground space-y-0.5">
            <li>Na TV, selecione o campo de e-mail com as setas.</li>
            <li>Clique em Digitar e-mail.</li>
            <li>Selecione o campo de senha.</li>
            <li>Clique em Digitar senha e entrar.</li>
          </ol>
          <div className="flex gap-2">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" autoComplete="off" />
            <Button size="sm" variant="outline" disabled={!email} onClick={() => { cmd("type_text", { text: email }); setEmail(""); }}>Digitar e-mail</Button>
          </div>
          <div className="flex gap-2">
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Senha" autoComplete="new-password" />
            <Button size="sm" variant="outline" disabled={!pwd} onClick={() => {
              runTv(async () => { await sendTvCommand(screen.slot, "type_text", { text: pwd }); await sendTvCommand(screen.slot, "key", { keys: ["ENTER"] }); });
              setPwd("");
            }}>Digitar senha e entrar</Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Button size="sm" variant="outline" onClick={() => cmd("pair")}><Link2 className="h-3.5 w-3.5 mr-1.5" />Conectar a TV de novo</Button>
          <Help>Use se a TV aparecer como Não conectada.</Help>
        </div>
      </section>
    </div>
  );
}

const MODES = [
  { value: "global", label: "Horário do escritório", help: "Segue o horário definido para todas as TVs (ex.: seg a sex, 07:50 às 19:30)." },
  { value: "custom", label: "Horário só desta TV", help: "Escolha dias e horários diferentes para esta TV." },
  { value: "always_on", label: "Sempre ligada", help: "A TV nunca é desligada automaticamente." },
  { value: "manual", label: "Sem horário automático", help: "Ninguém liga nem desliga sozinho; só pelos botões ou pelo controle." },
];
const REFRESH = [{ v: 0, l: "Nunca" }, { v: 15, l: "15 min" }, { v: 30, l: "30 min" }, { v: 60, l: "1 hora" }];

function officeHours(settings: any) {
  if (!settings) return "";
  const d: number[] = [...(settings.days ?? [])].sort();
  const names = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const contiguous = d.length > 1 && d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  const days = !d.length ? "nenhum dia" : contiguous ? `${names[d[0]]} a ${names[d[d.length - 1]]}` : d.map((x) => names[x]).join(", ");
  const t = (v?: string) => (v ?? "").slice(0, 5);
  return `${days}, ${t(settings.on_time)} às ${t(settings.off_time)}`;
}

function AgendaTab({ screen, settings }: { screen: any; settings?: any }) {
  const save = (patch: Record<string, unknown>) => runTv(() => updateTvScreen(screen.slot, patch));
  const playlist = tvContentKind(screen.url) === "playlist";
  const days: number[] = screen.custom_days ?? [];
  const refresh = playlist ? 0 : screen.refresh_min ?? 0;
  const refreshOpts = REFRESH.some((r) => r.v === refresh) ? REFRESH : [...REFRESH, { v: refresh, l: `${refresh} min` }].sort((a, b) => a.v - b.v);
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-xs">Quando a TV fica ligada</Label>
        <div role="radiogroup" className="grid gap-2">
          {MODES.map((m) => {
            const on = screen.schedule_mode === m.value;
            return (
              <div key={m.value} className={cn("rounded-md border transition", on ? "border-primary bg-primary/5" : "hover:border-primary/40")}>
                <button type="button" role="radio" aria-checked={on} onClick={() => !on && save({ schedule_mode: m.value })}
                  className="w-full text-left p-3 flex gap-3 items-start">
                  <span className={cn("mt-0.5 h-4 w-4 shrink-0 rounded-full border-2", on ? "border-primary bg-primary shadow-[inset_0_0_0_2px_hsl(var(--background))]" : "border-muted-foreground/50")} />
                  <span className="space-y-0.5 min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">{m.label}
                      {m.value === "global" && settings && <span className="text-xs font-normal text-muted-foreground">Agora: {officeHours(settings)}</span>}
                    </span>
                    <span className="block text-xs text-muted-foreground leading-snug">{m.help}</span>
                  </span>
                </button>
                {on && m.value === "custom" && (
                  <div className="space-y-2 px-3 pb-3 pl-10">
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((l, i) => {
                        const d = days.includes(i);
                        return <Button key={i} size="sm" variant={d ? "default" : "outline"} className="h-8 w-11 px-0"
                          onClick={() => save({ custom_days: d ? days.filter((x) => x !== i) : [...days, i].sort() })}>{l}</Button>;
                      })}
                    </div>
                    <div className="flex gap-3">
                      <div className="space-y-1"><Label className="text-xs">Liga às</Label>
                        <Input type="time" defaultValue={screen.custom_on_time ?? "07:50"} className="w-28" onBlur={(e) => save({ custom_on_time: e.target.value })} /></div>
                      <div className="space-y-1"><Label className="text-xs">Desliga às</Label>
                        <Input type="time" defaultValue={screen.custom_off_time ?? "19:30"} className="w-28" onBlur={(e) => save({ custom_off_time: e.target.value })} /></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {Array.isArray(settings?.rest_windows) && settings.rest_windows.length > 0 && (
        <div className="space-y-1">
          <label className="flex items-center justify-between gap-3 text-sm">Usar nos horários de descanso
            <Switch checked={screen.rest_enabled === true} onCheckedChange={(v) => save({ rest_enabled: v })} /></label>
          <Help>Nos horários de descanso cadastrados, esta TV mostra a tela de descanso do Roy mesmo tendo conteúdo.</Help>
        </div>
      )}

      <div className="space-y-1">
        <label className="flex items-center justify-between gap-3 text-sm">Impedir as fotos da LG
          <Switch checked={screen.keepalive} onCheckedChange={(v) => save({ keepalive: v })} /></label>
        <Help>Evita que a TV mostre as fotos da LG depois de alguns minutos parada.</Help>
      </div>

      <div className="space-y-1">
        <label className="flex items-center justify-between gap-3 text-sm">TV habilitada
          <Switch checked={screen.enabled} onCheckedChange={(v) => save({ enabled: v })} /></label>
        <Help>Desligado, a automação ignora esta TV.</Help>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Atualizar a página a cada</Label>
        <Select value={String(refresh)} disabled={playlist} onValueChange={(v) => { const n = Number(v); if (n !== screen.refresh_min) save({ refresh_min: n }); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{refreshOpts.map((r) => <SelectItem key={r.v} value={String(r.v)}>{r.l}</SelectItem>)}</SelectContent>
        </Select>
        <Help>{playlist ? "Não se aplica a vídeos." : "Recarrega o dashboard para garantir que os números estejam atualizados."}</Help>
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
  if (!rows.length) return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade ainda.</p>;
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
