import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Sparkles, Loader2, Download, Image as ImageIcon, Upload, X, Save, Wand2, Star, Plus,
} from "lucide-react";
import { REBRANDING_SPECS } from "@/data/rebrandingSpecs";

type PaletteColor = { hex: string; role: "predominant" | "support" };
const ETERNUM_PALETTE: PaletteColor[] = [
  { hex: "#0a0a0a", role: "predominant" },
  { hex: "#d2ae6d", role: "support" },
  { hex: "#efede6", role: "support" },
  { hex: "#42423d", role: "support" },
];

const normalizeHex = (v: string): string | null => {
  let s = v.trim().replace(/^#/, "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return `#${s.toLowerCase()}`;
};

const ASPECT_PRESETS = [
  { value: "1:1",  label: "Quadrado 1:1 (Instagram Post, 1080×1080)" },
  { value: "4:5",  label: "Retrato 4:5 (Instagram Feed, 1080×1350)" },
  { value: "9:16", label: "Vertical 9:16 (Stories/Reels, 1080×1920)" },
  { value: "16:9", label: "Paisagem 16:9 (YouTube/OG, 1920×1080)" },
  { value: "3:2",  label: "3:2 (Hero/Banner, 1200×800)" },
  { value: "21:9", label: "Ultra-wide 21:9 (Cover LinkedIn, 1920×820)" },
];

const STYLE_PRESETS = [
  "Fotografia editorial, luz natural cinematográfica",
  "Minimalista, fundo neutro, alto contraste",
  "Lifestyle premium, ambiente sofisticado",
  "Mockup de produto em superfície escura",
  "Ilustração vetorial flat com paleta da marca",
  "3D render moderno, materiais luxuosos",
];

interface StudioProps {
  initialChannelKey?: string | null;
  initialAssetLabel?: string | null;
  initialAspectRatio?: string;
  onClose?: () => void;
  embedded?: boolean;
}

export function AiStudio({
  initialChannelKey = null,
  initialAssetLabel = null,
  initialAspectRatio = "1:1",
  onClose,
  embedded = false,
}: StudioProps) {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  const refInput = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState("");
  const [styleNotes, setStyleNotes] = useState("");
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio);
  const [channelKey, setChannelKey] = useState<string | null>(initialChannelKey);
  const [assetLabel, setAssetLabel] = useState<string | null>(initialAssetLabel);
  const [palette, setPalette] = useState<string[]>(ETERNUM_PALETTE);
  const [refUrls, setRefUrls] = useState<string[]>([]);
  const [model, setModel] = useState("google/gemini-3-pro-image-preview");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{ w: number; h: number; genId: string } | null>(null);

  // Upload de referência -> bucket temp (usa mesmo bucket)
  const uploadRef = useMutation({
    mutationFn: async (file: File) => {
      if (!currentUser?.account_id) throw new Error("Sem conta");
      const path = `${currentUser.account_id}/_studio_refs/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("rebranding-assets").upload(path, file);
      if (error) throw error;
      const { data } = await supabase.storage.from("rebranding-assets").createSignedUrl(path, 3600);
      return data?.signedUrl as string;
    },
    onSuccess: (url) => {
      setRefUrls((prev) => [...prev, url].slice(0, 4));
      toast.success("Referência adicionada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("rebranding-generate-image", {
        body: {
          prompt,
          styleNotes,
          aspectRatio,
          palette,
          referenceUrls: refUrls,
          channelKey,
          assetLabel,
          model,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { dataUrl: string; generationId: string; width: number; height: number };
    },
    onSuccess: (data) => {
      setResultUrl(data.dataUrl);
      setResultMeta({ w: data.width, h: data.height, genId: data.generationId });
      toast.success("Imagem gerada!");
    },
    onError: (e: any) => toast.error(e.message || "Falha ao gerar"),
  });

  const saveAsAsset = useMutation({
    mutationFn: async () => {
      if (!resultUrl || !currentUser?.account_id || !channelKey || !assetLabel) {
        throw new Error("Selecione canal e asset para salvar");
      }
      // Convert dataUrl to blob
      const res = await fetch(resultUrl);
      const blob = await res.blob();
      const ext = blob.type.split("/")[1] || "png";
      const fileName = `ia_${Date.now()}.${ext}`;
      const path = `${currentUser.account_id}/${channelKey}/${encodeURIComponent(assetLabel)}/${fileName}`;
      const { error: upErr } = await supabase.storage
        .from("rebranding-assets")
        .upload(path, blob, { contentType: blob.type });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("rebranding_assets").insert({
        account_id: currentUser.account_id,
        channel_key: channelKey,
        asset_kind: "spec",
        asset_label: assetLabel,
        asset_dimensions: resultMeta ? `${resultMeta.w}×${resultMeta.h}` : null,
        asset_format: blob.type,
        status: "draft",
        version: 1,
        file_path: path,
        file_name: fileName,
        file_size_bytes: blob.size,
        mime_type: blob.type,
        uploaded_by: currentUser.id,
        uploaded_by_name: currentUser.name,
        source: "ai",
        notes: `Prompt: ${prompt.slice(0, 200)}`,
      });
      if (insErr) throw insErr;

      if (resultMeta?.genId) {
        await supabase.from("rebranding_ai_generations").update({ file_path: path }).eq("id", resultMeta.genId);
      }
    },
    onSuccess: () => {
      toast.success("Salvo no canal!");
      qc.invalidateQueries({ queryKey: ["rebranding_assets"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `eternum_${Date.now()}.png`;
    a.click();
  };

  const availableAssets = channelKey
    ? REBRANDING_SPECS.find((s) => s.key === channelKey)?.assets || []
    : [];

  const Container: any = embedded ? "div" : Card;

  return (
    <Container className={embedded ? "space-y-4" : ""}>
      {!embedded && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Studio de IA — Geração de Imagens Eternum
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={embedded ? "p-0 space-y-4" : "space-y-4"}>
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Coluna esquerda: configuração */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Modelo de IA</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google/gemini-3-pro-image-preview">Gemini 3 Pro Image (qualidade máxima)</SelectItem>
                  <SelectItem value="google/gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image (rápido)</SelectItem>
                  <SelectItem value="google/gemini-2.5-flash-image">Gemini 2.5 Flash (Nano Banana)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Dimensão / Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASPECT_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Canal (opcional)</Label>
                <Select value={channelKey || "none"} onValueChange={(v) => { setChannelKey(v === "none" ? null : v); setAssetLabel(null); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {REBRANDING_SPECS.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Asset (opcional)</Label>
                <Select value={assetLabel || "none"} onValueChange={(v) => setAssetLabel(v === "none" ? null : v)} disabled={!channelKey}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {availableAssets.map((a) => (
                      <SelectItem key={a.label} value={a.label}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Paleta da marca (cores guia)</Label>
              <div className="flex gap-1.5 mt-1 flex-wrap items-center">
                {palette.map((c, i) => (
                  <div key={i} className="relative group">
                    <div className="h-8 w-8 rounded border-2 border-border" style={{ background: c }} title={c} />
                    <button onClick={() => setPalette(palette.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-red-500 text-white rounded-full text-[8px] opacity-0 group-hover:opacity-100">×</button>
                  </div>
                ))}
                <Input
                  type="color"
                  className="h-8 w-8 p-0.5 cursor-pointer"
                  onChange={(e) => setPalette((p) => [...p, e.target.value].slice(0, 6))}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Estilo / MIV (referências escritas)</Label>
              <div className="flex gap-1 flex-wrap mb-1.5">
                {STYLE_PRESETS.map((s) => (
                  <Badge key={s} variant="outline" className="cursor-pointer text-[10px] hover:bg-primary/10"
                    onClick={() => setStyleNotes((cur) => cur ? `${cur}, ${s}` : s)}>
                    + {s.split(",")[0]}
                  </Badge>
                ))}
              </div>
              <Textarea value={styleNotes} onChange={(e) => setStyleNotes(e.target.value)}
                placeholder="Ex: fotografia editorial cinematográfica, luz natural, tons dourados"
                className="min-h-[60px] text-sm" />
            </div>

            <div>
              <Label className="text-xs">Referências visuais (logo, fotos, MIV) — até 4</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {refUrls.map((u, i) => (
                  <div key={i} className="relative">
                    <img src={u} alt="" className="h-14 w-14 object-cover rounded border" />
                    <button onClick={() => setRefUrls(refUrls.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full text-[10px]">×</button>
                  </div>
                ))}
                {refUrls.length < 4 && (
                  <button
                    onClick={() => refInput.current?.click()}
                    disabled={uploadRef.isPending}
                    className="h-14 w-14 rounded border-2 border-dashed flex items-center justify-center hover:bg-muted/50">
                    {uploadRef.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </button>
                )}
                <input ref={refInput} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadRef.mutate(f); e.target.value = ""; }} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Prompt principal</Label>
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                placeholder="Descreva a cena: o que aparece, ambiente, mood, ação, enquadramento... Ex: 'Empresário em escritório premium, olhando pela janela ao pôr do sol, vista panorâmica da cidade, tom aspiracional'"
                className="min-h-[120px] text-sm" />
              <div className="text-[10px] text-muted-foreground mt-1">{prompt.length}/4000</div>
            </div>

            <Button onClick={() => generate.mutate()} disabled={!prompt || generate.isPending} className="w-full">
              {generate.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</> : <><Sparkles className="h-4 w-4 mr-2" /> Gerar Imagem</>}
            </Button>
          </div>

          {/* Coluna direita: resultado */}
          <div className="space-y-3">
            <div className="rounded-lg border-2 border-dashed bg-muted/20 min-h-[400px] flex items-center justify-center p-4">
              {generate.isPending ? (
                <div className="text-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground">IA está criando a imagem...</p>
                  <p className="text-[11px] text-muted-foreground">Pode levar 10-30s</p>
                </div>
              ) : resultUrl ? (
                <img src={resultUrl} alt="Gerado" className="max-w-full max-h-[500px] object-contain rounded" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto opacity-30 mb-2" />
                  <p className="text-sm">A imagem aparecerá aqui</p>
                </div>
              )}
            </div>

            {resultUrl && (
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={handleDownload} className="flex-1">
                  <Download className="h-4 w-4 mr-2" /> Baixar PNG
                </Button>
                {channelKey && assetLabel && (
                  <Button onClick={() => saveAsAsset.mutate()} disabled={saveAsAsset.isPending} className="flex-1">
                    {saveAsAsset.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar no canal
                  </Button>
                )}
                <Button variant="ghost" onClick={() => { setResultUrl(null); setResultMeta(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-xs space-y-1">
              <div className="font-medium flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Dica</div>
              <p className="text-muted-foreground">
                Inclua referências visuais (logo, fotos do MIV) para a IA manter consistência da marca.
                Use prompts descritivos: ambiente, iluminação, mood, ângulo de câmera.
              </p>
            </div>
          </div>
        </div>

        {onClose && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        )}
      </CardContent>
    </Container>
  );
}
