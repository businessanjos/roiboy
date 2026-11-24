import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Paperclip, X, Loader2, Play, FileText, Music, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MediaAttachment } from "@/hooks/useMarketingTasks";
import { useMarketingTaskAttachment, taskAttachmentUrl } from "@/hooks/useMarketingTaskAttachments";
import { attachmentKey, TASK_FILES_BUCKET, TASK_FILE_TYPES, taskFileError, taskFileType } from "@/lib/marketing/taskPresentation";

interface MarketingTaskMediaUploadProps {
  attachments: MediaAttachment[];
  onAttachmentsChange: (attachments: MediaAttachment[]) => void;
  accountId: string;
  disabled?: boolean;
  onUploaded?: (path: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

function AttachmentItem({ attachment, onRemove, disabled }: { attachment: MediaAttachment; onRemove: () => void; disabled: boolean }) {
  const { data: url } = useMarketingTaskAttachment(attachment.type === "image" ? attachment : undefined);
  const open = async () => {
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try { const resolved = await taskAttachmentUrl(attachment); if (tab) tab.location.href = resolved; }
    catch { tab?.close(); toast.error("Não foi possível abrir o anexo. Tente novamente."); }
  };
  return <div className="flex min-w-0 items-center gap-3 border-b py-2 last:border-0">
    <Button type="button" variant="ghost" className="h-11 w-11 shrink-0 overflow-hidden p-0" aria-label={`Abrir ${attachment.name}`} title={`Abrir ${attachment.name}`} onClick={open}>
      {attachment.type === "image" && url ? <img src={url} alt={attachment.name} className="h-full w-full rounded object-cover" draggable={false} />
        : attachment.type === "video" ? <Play className="h-5 w-5 text-primary" /> : attachment.type === "audio" ? <Music className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-muted-foreground" />}
    </Button>
    <div className="min-w-0 flex-1"><p className="truncate text-sm" title={attachment.name}>{attachment.name}</p><p className="text-xs text-muted-foreground">{(attachment.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB</p></div>
    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" title={`Abrir ${attachment.name}`} aria-label={`Abrir anexo ${attachment.name}`} onClick={open}><ExternalLink className="h-4 w-4" /></Button>
    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" title={`Remover ${attachment.name}`} aria-label={`Remover anexo ${attachment.name}`} disabled={disabled} onClick={onRemove}><X className="h-4 w-4" /></Button>
  </div>;
}

export function MarketingTaskMediaUpload({
  attachments,
  onAttachmentsChange,
  accountId,
  disabled = false,
  onUploaded,
  onUploadingChange,
}: MarketingTaskMediaUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File): Promise<MediaAttachment | null> => {
    const error = taskFileError(file);
    if (error) {
      toast.error(error);
      return null;
    }

    if (!accountId) return null;
    const mimeType = taskFileType(file.name);
    if (!mimeType) return null;
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    const fileName = `${accountId}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(TASK_FILES_BUCKET)
      .upload(fileName, file, { contentType: mimeType });

    if (uploadError) {
      toast.error(`Não foi possível enviar “${file.name}”. Tente novamente.`);
      return null;
    }

    onUploaded?.(fileName);

    return {
      url: "",
      bucket: TASK_FILES_BUCKET,
      path: fileName,
      mime_type: mimeType,
      type: mimeType.startsWith("image/") ? "image" : mimeType.startsWith("video/") ? "video" : mimeType.startsWith("audio/") ? "audio" : "file",
      name: file.name,
      size: file.size,
      uploaded_at: new Date().toISOString(),
    };
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (disabled || isUploading || !accountId) return;
    const fileArray = Array.from(files);
    setIsUploading(true);
    onUploadingChange?.(true);
    const newAttachments: MediaAttachment[] = [];

    try { for (const file of fileArray) {
      const attachment = await uploadFile(file);
      if (attachment) {
        newAttachments.push(attachment);
      }
    }

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
      toast.success(`${newAttachments.length} arquivo(s) anexado(s)`);
    }

    } catch { toast.error("Não foi possível concluir o envio. Tente novamente."); }
    finally { setIsUploading(false); onUploadingChange?.(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleRemove = (index: number) => {
    // Detach only: saved files may also belong to duplicated tasks.
    const newAttachments = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(newAttachments);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        Anexos ({attachments.length})
      </Label>

      <div className="max-h-60 overflow-y-auto">
        {attachments.map((attachment, index) => <AttachmentItem key={attachmentKey(attachment)} attachment={attachment} onRemove={() => handleRemove(index)} disabled={disabled || isUploading} />)}
      </div>
      <div
          className={cn(
            "rounded-md border border-dashed p-3 transition-colors",
            isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/30 hover:border-primary/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Button type="button" variant="outline" disabled={disabled || isUploading || !accountId} onClick={() => fileInputRef.current?.click()}>
            {isUploading ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <Paperclip className="h-4 w-4" />}{isUploading ? "Enviando..." : "Adicionar anexos"}
          </Button>
        </div>

      <input
        ref={fileInputRef}
        type="file"
        aria-label="Arquivos da tarefa"
        accept={Object.keys(TASK_FILE_TYPES).map((ext) => `.${ext}`).join(",")}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        disabled={disabled || isUploading}
      />

    </div>
  );
}
