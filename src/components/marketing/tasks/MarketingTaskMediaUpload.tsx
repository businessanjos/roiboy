import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImagePlus, X, Loader2, Play, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ImageGalleryLightbox } from "@/components/ui/image-gallery-lightbox";

export interface MediaAttachment {
  url: string;
  type: "image" | "video";
  name: string;
  size: number;
  uploaded_at: string;
}

interface MarketingTaskMediaUploadProps {
  attachments: MediaAttachment[];
  onAttachmentsChange: (attachments: MediaAttachment[]) => void;
  accountId: string;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_TYPES = ["image/*", "video/*"];

export function MarketingTaskMediaUpload({
  attachments,
  onAttachmentsChange,
  accountId,
  disabled = false,
}: MarketingTaskMediaUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageAttachments = attachments.filter((a) => a.type === "image");

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `Arquivo "${file.name}" excede o limite de 50MB`;
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      return `Tipo de arquivo "${file.name}" não suportado. Use imagens ou vídeos.`;
    }

    return null;
  };

  const uploadFile = async (file: File): Promise<MediaAttachment | null> => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return null;
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${accountId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("marketing-task-media")
      .upload(fileName, file);

    if (uploadError) {
      toast.error(`Erro ao enviar ${file.name}: ${uploadError.message}`);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("marketing-task-media")
      .getPublicUrl(fileName);

    return {
      url: urlData.publicUrl,
      type: file.type.startsWith("image/") ? "image" : "video",
      name: file.name,
      size: file.size,
      uploaded_at: new Date().toISOString(),
    };
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    setIsUploading(true);
    const newAttachments: MediaAttachment[] = [];

    for (const file of fileArray) {
      const attachment = await uploadFile(file);
      if (attachment) {
        newAttachments.push(attachment);
      }
    }

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
      toast.success(`${newAttachments.length} arquivo(s) anexado(s)`);
    }

    setIsUploading(false);
  };

  const handleRemove = async (index: number) => {
    const attachment = attachments[index];

    // Extract path from URL
    const urlParts = attachment.url.split("/marketing-task-media/");
    if (urlParts.length === 2) {
      const filePath = urlParts[1];
      await supabase.storage.from("marketing-task-media").remove([filePath]);
    }

    const newAttachments = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(newAttachments);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
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

  const openLightbox = (attachment: MediaAttachment) => {
    const imageIndex = imageAttachments.findIndex((a) => a.url === attachment.url);
    if (imageIndex >= 0) {
      setLightboxIndex(imageIndex);
      setLightboxOpen(true);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />
        Anexos ({attachments.length})
      </Label>

      <div className="flex flex-wrap gap-2">
        {/* Existing attachments */}
        {attachments.map((attachment, index) => (
          <div
            key={attachment.url}
            className="relative group w-20 h-20 rounded-lg border overflow-hidden bg-muted"
          >
            {attachment.type === "image" ? (
              <img
                src={attachment.url}
                alt={attachment.name}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => openLightbox(attachment)}
              />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center cursor-pointer"
                onClick={() => window.open(attachment.url, "_blank")}
              >
                <Play className="h-6 w-6 text-primary" />
                <span className="text-[10px] text-muted-foreground mt-1 text-center px-1 truncate max-w-full">
                  {attachment.name}
                </span>
              </div>
            )}

            {/* Remove button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(index);
              }}
              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </button>

            {/* File size indicator */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5">
              {formatFileSize(attachment.size)}
            </div>
          </div>
        ))}

        {/* Upload zone */}
        <div
          className={cn(
            "w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors",
            isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/30 hover:border-primary/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground mt-1">Adicionar</span>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        disabled={disabled}
      />

      {/* Lightbox for images */}
      <ImageGalleryLightbox
        images={imageAttachments.map((a) => ({ url: a.url, alt: a.name }))}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
