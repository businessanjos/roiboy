import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/date-field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { tvMediaSrc, type TvImageFit } from "@/lib/tv/tvImage";

const db = supabase as any;
type Media = { id: string; path: string; url: string; name: string; created_at: string };

async function pdfFirstPage(file: File): Promise<Blob> {
  const pdfjs: any = await import("pdfjs-dist");
  const PdfWorker = (await import("pdfjs-dist/build/pdf.worker.min.js?worker")).default;
  if (!pdfjs.GlobalWorkerOptions.workerPort) pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(4, 1920 / base.width) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
  return await new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("Não deu para converter o PDF."))), "image/png"));
}

export function TvImagePicker({ path, fit, untilDate, untilTime, onChange }: {
  path: string; fit: TvImageFit; untilDate: string; untilTime: string;
  onChange: (p: Partial<{ img: string; fit: TvImageFit; untilD: string; untilT: string }>) => void;
}) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { data: media = [] } = useQuery({
    queryKey: ["tv-media"],
    queryFn: async () => {
      const { data, error } = await db.from("tv_media").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Media[];
    },
  });

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!isPdf && !["image/png", "image/jpeg"].includes(file.type)) throw new Error("Envie PNG, JPG ou PDF.");
      const blob = isPdf ? await pdfFirstPage(file) : file;
      const ext = isPdf || file.type === "image/png" ? "png" : "jpg";
      const p = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const up = await supabase.storage.from("tv-media").upload(p, blob, { contentType: ext === "png" ? "image/png" : "image/jpeg" });
      if (up.error) throw up.error;
      const { error } = await db.from("tv_media").insert({ path: p, url: tvMediaSrc(p), name: file.name.slice(0, 120) });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["tv-media"] });
      onChange({ img: p });
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e?.message ?? "Não deu para enviar a imagem.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async (m: Media) => {
    if (!window.confirm(`Apagar "${m.name}" das Mídias? TVs que estiverem mostrando essa imagem ficam sem ela.`)) return;
    const { error } = await db.from("tv_media").delete().eq("id", m.id);
    if (error) return toast.error("Não deu para apagar.");
    await supabase.storage.from("tv-media").remove([m.path]);
    if (m.path === path) onChange({ img: "" });
    qc.invalidateQueries({ queryKey: ["tv-media"] });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
          {path
            ? <img src={tvMediaSrc(path)} alt="Imagem escolhida" className={cn("h-full w-full", fit === "cover" ? "object-cover" : "object-contain")} draggable={false} />
            : <div className="grid h-full place-items-center text-xs text-muted-foreground">Nenhuma imagem escolhida</div>}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button type="button" variant="outline" className="h-10 w-full" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-1.5" />}Enviar imagem
        </Button>
        <p className="text-xs text-muted-foreground">PNG, JPG ou PDF. Do PDF, a TV mostra a primeira página.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Ajuste</Label>
        <ToggleGroup type="single" value={fit} onValueChange={(v) => v && onChange({ fit: v as TvImageFit })} className="grid grid-cols-2 rounded-lg bg-muted p-1">
          <ToggleGroupItem value="contain" className="h-auto min-h-10 whitespace-normal text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">Mostrar inteira (com bordas pretas)</ToggleGroupItem>
          <ToggleGroupItem value="cover" className="h-auto min-h-10 whitespace-normal text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">Preencher a tela</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Mostrar até (opcional)</Label>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <DateField value={untilDate} onChange={(e) => onChange({ untilD: e.target.value, untilT: untilTime || (e.target.value ? "18:00" : "") })} />
          <Input type="time" className="h-10" value={untilTime} disabled={!untilDate} onChange={(e) => onChange({ untilT: e.target.value })} aria-label="Hora" />
        </div>
        <p className="text-xs text-muted-foreground">
          {untilDate ? <>Passou do horário, a TV volta para o que mostrava antes. <button type="button" className="underline" onClick={() => onChange({ untilD: "", untilT: "" })}>Tirar prazo</button></> : "Sem prazo: a imagem fica até você trocar."}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Mídias</Label>
        {media.length === 0 ? <p className="text-xs text-muted-foreground">As imagens enviadas aparecem aqui para usar em outras TVs.</p> : (
          <div className="grid grid-cols-3 gap-2">
            {media.map((m) => (
              <div key={m.id} className={cn("group relative overflow-hidden rounded-md border", m.path === path && "ring-2 ring-primary")}>
                <button type="button" className="block aspect-video w-full bg-muted" title={m.name} onClick={() => onChange({ img: m.path })}>
                  <img src={m.url} alt={m.name} className="h-full w-full object-cover" loading="lazy" draggable={false} />
                </button>
                {m.path === path && <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
                <Button type="button" size="icon" variant="secondary" aria-label={`Apagar ${m.name}`} className="absolute right-1 top-1 h-6 w-6" onClick={() => remove(m)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
