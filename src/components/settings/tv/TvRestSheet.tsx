import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, GripVertical, ImagePlus, Plus, Trash2, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { updateTvSettings } from "@/hooks/useTvWall";
import { TV_REST_BUCKET, signTvRestPaths } from "@/hooks/useTvRestContent";
import type { RestMessage, RestWindow } from "@/lib/tv/restScreen";
import { cn } from "@/lib/utils";
import { runTv } from "./tvShared";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SAVED = "Salvo. As TVs pegam a mudança em alguns minutos.";

/** Reduz para no máximo 1920 px de largura e grava em WebP (logo mantém PNG pela transparência). */
async function optimizeForTv(file: File, keepPng: boolean): Promise<{ blob: Blob; ext: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const type = keepPng ? "image/png" : "image/webp";
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Não foi possível ler a imagem"))), type, 0.88));
  return { blob, ext: keepPng ? "png" : "webp" };
}

async function uploadRestImage(file: File, keepPng = false) {
  const { blob, ext } = await optimizeForTv(file, keepPng);
  const path = `custom/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(TV_REST_BUCKET).upload(path, blob, { contentType: blob.type });
  if (error) throw error;
  return path;
}

function useSigned(paths: string[]) {
  const [map, setMap] = useState<Record<string, string>>({});
  const key = paths.join("|");
  useEffect(() => {
    let off = false;
    signTvRestPaths(paths).then((urls) => { if (!off) setMap(Object.fromEntries(paths.map((p, i) => [p, urls[i]]))); });
    return () => { off = true; };
  }, [key]);
  return map;
}

export function TvRestSheet({ open, onOpenChange, settings }: { open: boolean; onOpenChange: (v: boolean) => void; settings?: any }) {
  const qc = useQueryClient();
  const logo: string | null = settings?.rest_logo_url ?? null;
  const photos: string[] = Array.isArray(settings?.rest_photos) ? settings.rest_photos : [];
  const messages: RestMessage[] = Array.isArray(settings?.rest_messages) ? settings.rest_messages : [];
  const windows: RestWindow[] = Array.isArray(settings?.rest_windows) ? settings.rest_windows : [];
  const signed = useSigned([logo, ...photos].filter(Boolean) as string[]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [newMsg, setNewMsg] = useState("");
  const logoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const save = (patch: Record<string, unknown>) =>
    runTv(async () => { await updateTvSettings(patch); await qc.invalidateQueries({ queryKey: ["tv-wall"] }); qc.invalidateQueries({ queryKey: ["tv-rest-content"] }); }, SAVED);

  const onLogo = async (f?: File) => {
    if (!f) return; setBusy(true);
    try { const path = await uploadRestImage(f, true); await save({ rest_logo_url: path }); } finally { setBusy(false); }
  };
  const onPhotos = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true);
    try {
      const added: string[] = [];
      for (const f of Array.from(files)) added.push(await uploadRestImage(f));
      await save({ rest_photos: [...photos, ...added] });
    } finally { setBusy(false); }
  };
  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...photos]; const [x] = next.splice(from, 1); next.splice(to, 0, x);
    save({ rest_photos: next });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader><SheetTitle>Tela de descanso</SheetTitle></SheetHeader>
        <p className="mt-2 text-sm text-muted-foreground">
          Aparece sozinha nas TVs sem conteúdo, no lugar das fotos da LG. Se alguém estiver transmitindo ou usando um app na TV, ela não interrompe.
        </p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <a href="/tv/descanso" target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Ver prévia</a>
        </Button>

        <section className="mt-6 space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Logo</h4>
          <div className="flex items-center gap-3">
            <div className="tv-rest flex h-16 w-40 items-center justify-center rounded-md border px-3">
              {logo && signed[logo] ? <img src={signed[logo]} alt="Logo" className="max-h-8 w-auto" /> : <span className="tv-rest-wordmark !text-base">ETERNUM</span>}
            </div>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => logoInput.current?.click()}><Upload className="h-3.5 w-3.5 mr-1.5" />Trocar</Button>
            <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          <p className="text-xs text-muted-foreground">Prefira PNG com fundo transparente e letras claras.</p>
        </section>

        <section className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fotos ({photos.length})</h4>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => photoInput.current?.click()}><ImagePlus className="h-3.5 w-3.5 mr-1.5" />Adicionar</Button>
            <input ref={photoInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onPhotos(e.target.files); e.target.value = ""; }} />
          </div>
          <p className="text-xs text-muted-foreground">Arraste para mudar a ordem. Use fotos deitadas (16:9) com boa resolução.</p>
          {photos.length === 0 ? <p className="text-sm text-muted-foreground py-3">Nenhuma foto. A TV mostra só o logo e o relógio.</p> : (
            <ul className="grid grid-cols-2 gap-2">
              {photos.map((p, i) => (
                <li key={p} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (drag != null) move(drag, i); setDrag(null); }}
                  className={cn("group relative overflow-hidden rounded-md border bg-muted aspect-video cursor-grab", drag === i && "opacity-50")}>
                  {signed[p] && <img src={signed[p]} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" draggable={false} />}
                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-background/85 px-1.5 py-0.5 text-[11px]"><GripVertical className="h-3 w-3" />{i + 1}</span>
                  <Button size="icon" variant="secondary" aria-label="Remover foto" className="absolute right-1.5 top-1.5 h-7 w-7"
                    onClick={() => save({ rest_photos: photos.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mensagens na faixa de baixo</h4>
          <p className="text-xs text-muted-foreground">Trocam a cada 15 segundos. Sem mensagens ativas, a faixa não aparece.</p>
          <ul className="space-y-1.5">
            {messages.map((m, i) => (
              <li key={i} className="flex items-center gap-2">
                <Input defaultValue={m.text} className="h-8" onBlur={(e) => { const t = e.target.value.trim(); if (t !== m.text) save({ rest_messages: messages.map((x, j) => (j === i ? { ...x, text: t } : x)) }); }} />
                <Switch checked={m.active !== false} aria-label="Ativa" onCheckedChange={(v) => save({ rest_messages: messages.map((x, j) => (j === i ? { ...x, active: v } : x)) })} />
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Remover mensagem" onClick={() => save({ rest_messages: messages.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = newMsg.trim(); if (!t) return; save({ rest_messages: [...messages, { text: t, active: true }] }); setNewMsg(""); }}>
            <Input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Nova mensagem" className="h-8" />
            <Button size="sm" type="submit" variant="outline" disabled={!newMsg.trim()}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>
          </form>
        </section>

        <Collapsible className="mt-6 rounded-md border">
          <CollapsibleTrigger className="group flex w-full items-center justify-between p-3 text-sm font-medium">
            Horários de descanso (opcional){windows.length ? ` · ${windows.length}` : ""}
            <ChevronDown className="h-4 w-4 transition group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 px-3 pb-3">
            <p className="text-xs text-muted-foreground">Use só se quiser que TVs com conteúdo também mostrem a tela de descanso em certos horários.</p>
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
