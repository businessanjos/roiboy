import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Moon, Plus, RotateCcw, Sun, Trash2, Tv, Undo2, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { updateTvScreen, updateTvSettings } from "@/hooks/useTvWall";
import { TV_REST_BUCKET, signTvRestPaths } from "@/hooks/useTvRestContent";
import { isReleased } from "@/lib/tv/tvConn";
import type { RestWindow } from "@/lib/tv/restScreen";
import dayDefault from "@/assets/eternum-descanso-claro.webp.asset.json";
import nightDefault from "@/assets/eternum-descanso-escuro.png.asset.json";
import { runTv } from "./tvShared";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SAVED = "Salvo. As TVs pegam a mudança em alguns minutos.";
const H = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

async function uploadRestImage(file: File) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Não foi possível ler a imagem"))), "image/webp", 0.9));
  const path = `custom/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(TV_REST_BUCKET).upload(path, blob, { contentType: blob.type });
  if (error) throw error;
  return path;
}

function useSigned(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let off = false; setUrl(null); if (path) signTvRestPaths([path]).then((u) => !off && setUrl(u[0] ?? null)); return () => { off = true; }; }, [path]);
  return url;
}

function ImageSlot({ icon, title, hint, path, fallback, onPick, onReset, busy }: {
  icon: React.ReactNode; title: string; hint: string; path: string | null; fallback: string; onPick: (f: File) => void; onReset: () => void; busy: boolean;
}) {
  const signed = useSigned(path);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2 rounded-lg border p-2.5">
      <div className="flex items-center gap-1.5 text-sm font-medium">{icon}{title}<span className="ml-auto text-xs font-normal text-muted-foreground">{hint}</span></div>
      <div className="aspect-video overflow-hidden rounded-md border bg-muted">
        <img src={path ? signed ?? "" : fallback} alt={title} className="h-full w-full object-cover" draggable={false} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={() => input.current?.click()}><Upload className="h-3.5 w-3.5 mr-1.5" />Trocar</Button>
        {path && <Button size="sm" variant="ghost" disabled={busy} onClick={onReset}><RotateCcw className="h-3.5 w-3.5 mr-1.5" />Padrão</Button>}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
    </div>
  );
}

function ExtraItem({ item, busy, onToggle, onRemove }: { item: { path: string; period: "day" | "night" }; busy: boolean; onToggle: () => void; onRemove: () => void }) {
  const url = useSigned(item.path);
  const night = item.period === "night";
  return (
    <div className="space-y-1.5 rounded-lg border p-2">
      <div className="aspect-video overflow-hidden rounded-md border bg-muted">{url && <img src={url} alt="Tela extra" className="h-full w-full object-cover" draggable={false} />}</div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" className="h-7 flex-1 px-1.5 text-xs" disabled={busy} onClick={onToggle} title="Trocar entre dia e noite">
          {night ? <Moon className="h-3.5 w-3.5 mr-1" /> : <Sun className="h-3.5 w-3.5 mr-1" />}{night ? "Noite" : "Dia"}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busy} onClick={onRemove} aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

export function TvRestSheet({ open, onOpenChange, settings, screens = [] }: { open: boolean; onOpenChange: (v: boolean) => void; settings?: any; screens?: any[] }) {
  const qc = useQueryClient();
  const windows: RestWindow[] = Array.isArray(settings?.rest_windows) ? settings.rest_windows : [];
  const dayFrom: string = settings?.rest_day_from ?? "06:00";
  const nightFrom: string = settings?.rest_night_from ?? "18:00";
  const [busy, setBusy] = useState(false);
  const extras: { path: string; period: "day" | "night" }[] = Array.isArray(settings?.rest_extra) ? settings.rest_extra : [];
  const addInput = useRef<HTMLInputElement>(null);
  const [addPeriod, setAddPeriod] = useState<"day" | "night">("day");
  const addExtra = async (f: File) => { setBusy(true); try { const p = await uploadRestImage(f); await save({ rest_extra: [...extras, { path: p, period: addPeriod }] }); } finally { setBusy(false); } };

  const refresh = async () => { await qc.invalidateQueries({ queryKey: ["tv-wall"] }); qc.invalidateQueries({ queryKey: ["tv-rest-content"] }); };
  const save = (patch: Record<string, unknown>) => runTv(async () => { await updateTvSettings(patch); await refresh(); }, SAVED);
  const pick = async (key: string, f: File) => { setBusy(true); try { const p = await uploadRestImage(f); await save({ [key]: p }); } finally { setBusy(false); } };

  const free = screens.filter((s) => s.enabled && !isReleased(s));
  const toRest = free.filter((s) => s.url);
  const toBack = screens.filter((s) => s.rest_prev_url && !s.url);
  const allToRest = () => runTv(async () => {
    await Promise.all(toRest.map((s) => updateTvScreen(s.slot, { rest_prev_url: s.url, url: null })));
    await refresh();
  }, `${toRest.length} TV${toRest.length === 1 ? "" : "s"} em descanso. Elas trocam em até 30 segundos.`);
  const allBack = () => runTv(async () => {
    await Promise.all(toBack.map((s) => updateTvScreen(s.slot, { url: s.rest_prev_url, rest_prev_url: null })));
    await refresh();
  }, "As TVs voltam ao que estavam passando em até 30 segundos.");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader><SheetTitle>Tela de descanso</SheetTitle></SheetHeader>
        <p className="mt-2 text-sm text-muted-foreground">A arte Eternum em tela cheia: clara durante o dia e escura à noite. Aparece nas TVs sem conteúdo.</p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <a href="/tv/descanso" target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Ver prévia</a>
        </Button>

        <section className="mt-6 space-y-2">
          <h4 className={H}>Todas as TVs</h4>
          <div className="grid grid-cols-1 gap-2">
            <Button variant="outline" disabled={!toRest.length} onClick={allToRest}><Moon className="h-4 w-4 mr-1.5" />Colocar todas em descanso</Button>
            <Button variant="outline" disabled={!toBack.length} onClick={allBack}><Undo2 className="h-4 w-4 mr-1.5" />Voltar ao que passava</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {toRest.length} com conteúdo · {free.length - toRest.length} já em descanso{toBack.length ? ` · ${toBack.length} pode${toBack.length === 1 ? "" : "m"} voltar ao que passava` : ""}. TVs liberadas não mudam.
          </p>
        </section>

        <section className="mt-6 space-y-2">
          <h4 className={H}>Imagens</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ImageSlot icon={<Sun className="h-4 w-4" />} title="Dia" hint={`a partir de ${dayFrom}`} path={settings?.rest_day_image ?? null} fallback={dayDefault.url}
              busy={busy} onPick={(f) => pick("rest_day_image", f)} onReset={() => save({ rest_day_image: null })} />
            <ImageSlot icon={<Moon className="h-4 w-4" />} title="Noite" hint={`a partir de ${nightFrom}`} path={settings?.rest_night_image ?? null} fallback={nightDefault.url}
              busy={busy} onPick={(f) => pick("rest_night_image", f)} onReset={() => save({ rest_night_image: null })} />
          </div>
        </section>

        <section className="mt-6 space-y-2">
          <h4 className={H}>Mais telas de descanso</h4>
          <p className="text-xs text-muted-foreground">Imagens extras revezam com a principal do mesmo período, 1 minuto cada.</p>
          {extras.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {extras.map((e, i) => <ExtraItem key={e.path} item={e} busy={busy}
                onToggle={() => save({ rest_extra: extras.map((x, j) => (j === i ? { ...x, period: x.period === "day" ? "night" : "day" } : x)) })}
                onRemove={() => save({ rest_extra: extras.filter((_, j) => j !== i) })} />)}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setAddPeriod("day"); addInput.current?.click(); }}><Plus className="h-3.5 w-3.5 mr-1.5" /><Sun className="h-3.5 w-3.5 mr-1" />Adicionar de dia</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setAddPeriod("night"); addInput.current?.click(); }}><Plus className="h-3.5 w-3.5 mr-1.5" /><Moon className="h-3.5 w-3.5 mr-1" />Adicionar de noite</Button>
          </div>
          <input ref={addInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addExtra(f); e.target.value = ""; }} />
        </section>

        <section className="mt-6 space-y-2">
          <h4 className={H}>Quando trocar</h4>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label className="text-xs">Clara a partir de</Label>
              <Input key={`d${dayFrom}`} type="time" defaultValue={dayFrom} className="h-9 w-32" onBlur={(e) => e.target.value && e.target.value !== dayFrom && save({ rest_day_from: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Escura a partir de</Label>
              <Input key={`n${nightFrom}`} type="time" defaultValue={nightFrom} className="h-9 w-32" onBlur={(e) => e.target.value && e.target.value !== nightFrom && save({ rest_night_from: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Horário de Brasília. A troca é suave, sem piscar.</p>
        </section>

        <Collapsible className="mt-6 rounded-md border">
          <CollapsibleTrigger className="group flex w-full items-center justify-between p-3 text-sm font-medium">
            <span className="flex items-center gap-1.5"><Tv className="h-4 w-4" />Descanso automático (opcional){windows.length ? ` · ${windows.length}` : ""}</span>
            <ChevronDown className="h-4 w-4 transition group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 px-3 pb-3">
            <p className="text-xs text-muted-foreground">TVs com conteúdo também mostram a tela de descanso nesses horários (ligue em cada TV, aba Horário).</p>
            {windows.map((w, i) => {
              const upd = (patch: Partial<RestWindow>) => save({ rest_windows: windows.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <div key={i} className="space-y-2 rounded-md bg-muted/40 p-2.5">
                  <div className="flex flex-wrap gap-1">
                    {DAYS.map((l, d) => {
                      const on = w.days.includes(d);
                      return <Button key={d} size="sm" variant={on ? "default" : "outline"} className="h-7 w-10 px-0 text-xs"
                        onClick={() => upd({ days: on ? w.days.filter((x) => x !== d) : [...w.days, d].sort() })}>{l}</Button>;
                    })}
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="space-y-1"><Label className="text-xs">Início</Label><Input type="time" defaultValue={w.start} className="h-8 w-28" onBlur={(e) => e.target.value !== w.start && upd({ start: e.target.value })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Fim</Label><Input type="time" defaultValue={w.end} className="h-8 w-28" onBlur={(e) => e.target.value !== w.end && upd({ end: e.target.value })} /></div>
                    <Button size="icon" variant="ghost" className="ml-auto h-8 w-8" aria-label="Remover horário" onClick={() => save({ rest_windows: windows.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              );
            })}
            <Button size="sm" variant="outline" onClick={() => save({ rest_windows: [...windows, { days: [1, 2, 3, 4, 5], start: "12:00", end: "13:00" }] })}>
              <Plus className="h-3.5 w-3.5 mr-1" />Adicionar horário
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </SheetContent>
    </Sheet>
  );
}
