import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import Cropper, { Area } from "react-easy-crop";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FormLogoUploadProps {
  currentUrl?: string;
  accountId: string;
  formId?: string;
  onUpload: (url: string) => void;
  onRemove?: () => void;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

const createCroppedImage = async (
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob | null> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
  });
};

export function FormLogoUpload({
  currentUrl,
  accountId,
  formId,
  onUpload,
  onRemove,
}: FormLogoUploadProps) {
  const [open, setOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setImageSrc(reader.result as string);
    });
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setUploading(true);
    try {
      const croppedBlob = await createCroppedImage(imageSrc, croppedAreaPixels);
      if (!croppedBlob) throw new Error("Falha ao processar imagem");

      const fileName = `${accountId}/${formId || "new"}-logo-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("form-assets")
        .upload(fileName, croppedBlob, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("form-assets")
        .getPublicUrl(fileName);

      onUpload(urlData.publicUrl);
      toast.success("Logo atualizado com sucesso!");
      setOpen(false);
      setImageSrc(null);
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentUrl) return;

    setRemoving(true);
    try {
      // Extract file path from URL
      const urlParts = currentUrl.split("/form-assets/");
      if (urlParts[1]) {
        await supabase.storage.from("form-assets").remove([urlParts[1]]);
      }
      onRemove?.();
      toast.success("Logo removido");
    } catch (error) {
      console.error("Erro ao remover logo:", error);
      toast.error("Erro ao remover logo");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Logo ou Imagem</label>
      
      <div className="flex items-center gap-4">
        {currentUrl ? (
          <div className="relative w-20 h-20 rounded-lg border overflow-hidden bg-muted">
            <img
              src={currentUrl}
              alt="Logo do formulário"
              className="w-full h-full object-contain"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </Button>
          </div>
        ) : (
          <div className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50">
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}

        <Button variant="outline" onClick={() => setOpen(true)}>
          <Upload className="h-4 w-4 mr-2" />
          {currentUrl ? "Alterar" : "Adicionar Logo"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Logo</DialogTitle>
          </DialogHeader>

          {!imageSrc ? (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById("logo-input")?.click()}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Clique para selecionar uma imagem
                </p>
                <p className="text-xs text-muted-foreground/50 mt-1">
                  PNG, JPG até 5MB
                </p>
              </div>
              <input
                id="logo-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative h-64 rounded-lg overflow-hidden bg-muted">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={3}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Zoom:</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setImageSrc(null)}
                  disabled={uploading}
                >
                  Trocar Imagem
                </Button>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Logo"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
