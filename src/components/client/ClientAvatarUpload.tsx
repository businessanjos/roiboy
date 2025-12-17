import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ClientAvatarUploadProps {
  clientId: string;
  clientName: string;
  currentAvatarUrl?: string | null;
  onAvatarChange: (newUrl: string | null) => void;
  size?: "sm" | "md" | "lg";
}

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export function ClientAvatarUpload({
  clientId,
  clientName,
  currentAvatarUrl,
  onAvatarChange,
  size = "lg",
}: ClientAvatarUploadProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-14 w-14",
    lg: "h-20 w-20",
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      // Generate unique filename
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${clientId}-${Date.now()}.${fileExt}`;
      const filePath = `clients/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, selectedFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update client record
      const { error: updateError } = await supabase
        .from("clients")
        .update({ avatar_url: publicUrl })
        .eq("id", clientId);

      if (updateError) throw updateError;

      // Delete old avatar if exists
      if (currentAvatarUrl) {
        const oldPath = currentAvatarUrl.split("/avatars/")[1];
        if (oldPath) {
          await supabase.storage.from("avatars").remove([oldPath]);
        }
      }

      onAvatarChange(publicUrl);
      toast.success("Foto atualizada com sucesso!");
      closeDialog();
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast.error(error.message || "Erro ao fazer upload da foto");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentAvatarUrl) return;

    setUploading(true);
    try {
      // Delete from storage
      const filePath = currentAvatarUrl.split("/avatars/")[1];
      if (filePath) {
        await supabase.storage.from("avatars").remove([filePath]);
      }

      // Update client record
      const { error } = await supabase
        .from("clients")
        .update({ avatar_url: null })
        .eq("id", clientId);

      if (error) throw error;

      onAvatarChange(null);
      toast.success("Foto removida com sucesso!");
      closeDialog();
    } catch (error: any) {
      console.error("Error removing avatar:", error);
      toast.error(error.message || "Erro ao remover foto");
    } finally {
      setUploading(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setPreview(null);
    setSelectedFile(null);
    setIsDragging(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="relative group"
      >
        <Avatar className={cn(sizeClasses[size], "cursor-pointer ring-2 ring-background")}>
          {currentAvatarUrl ? (
            <AvatarImage src={currentAvatarUrl} alt={clientName} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
            {getInitials(clientName)}
          </AvatarFallback>
        </Avatar>
        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera className="h-5 w-5 text-white" />
        </div>
      </button>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Foto do cliente</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
            >
              {preview ? (
                <div className="flex flex-col items-center gap-4">
                  <Avatar className="h-32 w-32">
                    <AvatarImage src={preview} alt="Preview" />
                    <AvatarFallback>{getInitials(clientName)}</AvatarFallback>
                  </Avatar>
                  <p className="text-sm text-muted-foreground">
                    Clique para trocar a imagem
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Arraste uma imagem ou clique para selecionar</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      PNG, JPG até 5MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleInputChange}
              className="hidden"
            />

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              {currentAvatarUrl && !preview && (
                <Button
                  variant="destructive"
                  onClick={handleRemove}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <X className="h-4 w-4 mr-2" />
                  )}
                  Remover foto
                </Button>
              )}
              {preview && (
                <>
                  <Button variant="outline" onClick={closeDialog} disabled={uploading}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpload} disabled={uploading}>
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
