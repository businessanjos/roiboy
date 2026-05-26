import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Upload, Download, Trash2, Image as ImageIcon, FileText, Loader2,
  CheckCircle2, XCircle, Clock, Sparkles, Eye,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  draft:    { label: "Rascunho",     cls: "bg-slate-500/15 text-slate-700",   icon: Clock },
  review:   { label: "Em revisão",   cls: "bg-amber-500/15 text-amber-700",   icon: Eye },
  approved: { label: "Aprovado",     cls: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
  rejected: { label: "Reprovado",    cls: "bg-red-500/15 text-red-700",       icon: XCircle },
};

type Asset = {
  id: string;
  account_id: string;
  channel_key: string;
  asset_kind: string;
  asset_label: string;
  asset_dimensions: string | null;
  status: string;
  version: number;
  file_path: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  notes: string | null;
  uploaded_by_name: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  source: string;
  created_at: string;
};

interface AssetUploadBoxProps {
  channelKey: string;
  channelId?: string | null;
  assetLabel: string;
  assetDimensions?: string;
  assetFormat?: string;
  assetKind?: "spec" | "extra";
  onAiGenerate?: () => void;
}

export function AssetUploadBox({
  channelKey, channelId, assetLabel, assetDimensions, assetFormat,
  assetKind = "spec", onAiGenerate,
}: AssetUploadBoxProps) {
  const qc = useQueryClient();
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const { data: assets = [] } = useQuery({
    queryKey: ["rebranding_assets", channelKey, assetLabel, accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rebranding_assets")
        .select("*")
        .eq("channel_key", channelKey)
        .eq("asset_label", assetLabel)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Asset[];
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!accountId) throw new Error("Conta não identificada");
      if (file.size > 50 * 1024 * 1024) throw new Error("Arquivo excede 50MB");

      const ext = file.name.split(".").pop() || "bin";
      const ts = Date.now();
      const path = `${accountId}/${channelKey}/${encodeURIComponent(assetLabel)}/${ts}_${file.name}`;

      const { error: upErr } = await supabase.storage
        .from("rebranding-assets")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const nextVersion = (assets[0]?.version || 0) + 1;
      const { error: insErr } = await supabase.from("rebranding_assets").insert({
        account_id: accountId,
        channel_id: channelId || null,
        channel_key: channelKey,
        asset_kind: assetKind,
        asset_label: assetLabel,
        asset_dimensions: assetDimensions || null,
        asset_format: assetFormat || null,
        status: "draft",
        version: nextVersion,
        file_path: path,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        uploaded_by: profile?.id,
        uploaded_by_name: profile?.name,
        source: "upload",
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("Arquivo enviado");
      qc.invalidateQueries({ queryKey: ["rebranding_assets", channelKey, assetLabel] });
    },
    onError: (e: any) => toast.error(e.message || "Falha no upload"),
    onSettled: () => setUploading(false),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const { error } = await supabase.from("rebranding_assets").update({
        status,
        reviewed_by: profile?.id,
        reviewed_by_name: profile?.name,
        reviewed_at: new Date().toISOString(),
        review_note: note || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["rebranding_assets", channelKey, assetLabel] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (asset: Asset) => {
      await supabase.storage.from("rebranding-assets").remove([asset.file_path]);
      const { error } = await supabase.from("rebranding_assets").delete().eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Arquivo removido");
      qc.invalidateQueries({ queryKey: ["rebranding_assets", channelKey, assetLabel] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDownload = async (asset: Asset) => {
    const { data, error } = await supabase.storage
      .from("rebranding-assets")
      .createSignedUrl(asset.file_path, 300, { download: asset.file_name });
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível gerar link de download");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handlePreview = async (asset: Asset) => {
    const { data } = await supabase.storage
      .from("rebranding-assets")
      .createSignedUrl(asset.file_path, 300);
    setSignedUrl(data?.signedUrl || null);
    setPreviewAsset(asset);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    upload.mutate(f);
    e.target.value = "";
  };

  const approved = assets.find((a) => a.status === "approved");

  return (
    <div className="rounded-md border bg-card p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-xs">{assetLabel}</span>
            {assetDimensions && (
              <code className="text-[10px] text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">
                {assetDimensions}
              </code>
            )}
            {approved && (
              <Badge className="bg-emerald-500/15 text-emerald-700 text-[10px]">
                <CheckCircle2 className="h-3 w-3 mr-0.5" /> Pronto
              </Badge>
            )}
          </div>
          {assetFormat && (
            <div className="text-[10px] text-muted-foreground mt-0.5">Formato: {assetFormat}</div>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {onAiGenerate && (
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onAiGenerate} title="Gerar com IA">
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          </Button>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            accept="image/*,application/pdf,.psd,.ai,.fig,.sketch,.svg,.zip"
            onChange={onPick}
          />
        </div>
      </div>

      {assets.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic">Nenhum arquivo enviado ainda</div>
      ) : (
        <div className="space-y-1.5">
          {assets.map((a) => {
            const meta = STATUS_META[a.status] || STATUS_META.draft;
            const Icon = meta.icon;
            const isImg = a.mime_type?.startsWith("image/");
            return (
              <div key={a.id} className="flex items-center gap-2 p-1.5 rounded border bg-background text-[11px]">
                {isImg ? <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{a.file_name}</div>
                  <div className="text-muted-foreground text-[10px] flex items-center gap-1.5">
                    <span>v{a.version}</span>
                    {a.uploaded_by_name && <span>• {a.uploaded_by_name}</span>}
                    {a.source === "ai" && <Badge variant="outline" className="text-[9px] h-3.5 px-1">IA</Badge>}
                  </div>
                </div>
                <Badge className={`${meta.cls} text-[9px] gap-0.5`} variant="secondary">
                  <Icon className="h-2.5 w-2.5" /> {meta.label}
                </Badge>
                {isImg && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handlePreview(a)} title="Visualizar">
                    <Eye className="h-3 w-3" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDownload(a)} title="Baixar">
                  <Download className="h-3 w-3" />
                </Button>
                {a.status === "draft" && (
                  <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]"
                    onClick={() => updateStatus.mutate({ id: a.id, status: "review" })}>
                    → Revisão
                  </Button>
                )}
                {a.status === "review" && (
                  <>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-emerald-600"
                      onClick={() => updateStatus.mutate({ id: a.id, status: "approved" })} title="Aprovar">
                      <CheckCircle2 className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-600"
                      onClick={() => updateStatus.mutate({ id: a.id, status: "rejected" })} title="Rejeitar">
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                  onClick={() => { if (confirm("Remover arquivo?")) remove.mutate(a); }} title="Remover">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewAsset} onOpenChange={(o) => !o && setPreviewAsset(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewAsset?.file_name}</DialogTitle>
          </DialogHeader>
          {signedUrl && (
            <img src={signedUrl} alt={previewAsset?.asset_label} className="max-h-[70vh] w-full object-contain rounded" />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => previewAsset && handleDownload(previewAsset)}>
              <Download className="h-4 w-4 mr-2" /> Baixar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
