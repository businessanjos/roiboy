import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Camera, Upload, X, Loader2, ZoomIn, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Cropper, { Area } from "react-easy-crop";

interface InstagramProfileAvatarUploadProps {
  profileId: string;
  username: string;
  currentAvatarUrl?: string | null;
  onAvatarChange: (newUrl: string | null) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper function to create cropped image
const createCroppedImage = async (
  imageSrc: string,
  pixelCrop: Area,
  rotation: number = 0
): Promise<Blob> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  const rotRad = (rotation * Math.PI) / 180;

  // Calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  );

  // Set canvas size to match the bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Translate canvas context to center and rotate
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);

  // Draw rotated image
  ctx.drawImage(image, 0, 0);

  // Extract the cropped area
  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    throw new Error("Could not get cropped canvas context");
  }

  // Set final size (square for avatar)
  const finalSize = Math.min(pixelCrop.width, pixelCrop.height);
  croppedCanvas.width = finalSize;
  croppedCanvas.height = finalSize;

  // Draw the cropped image
  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    finalSize,
    finalSize
  );

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob"));
        }
      },
      "image/jpeg",
      0.9
    );
  });
};

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

const rotateSize = (width: number, height: number, rotation: number) => {
  const rotRad = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
};

export function InstagramProfileAvatarUpload({
  profileId,
  username,
  currentAvatarUrl,
  onAvatarChange,
  open,
  onOpenChange,
}: InstagramProfileAvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 50MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setImageSrc(e.target?.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
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
    if (!imageSrc || !croppedAreaPixels) return;

    setUploading(true);
    try {
      // Create cropped image blob
      const croppedBlob = await createCroppedImage(imageSrc, croppedAreaPixels, rotation);

      // Generate unique filename
      const fileName = `instagram-profiles/${profileId}-${Date.now()}.jpg`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, croppedBlob, { 
          upsert: true,
          contentType: "image/jpeg"
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // Update instagram_profiles record
      const { error: updateError } = await supabase
        .from("instagram_profiles")
        .update({ profile_picture_url: publicUrl })
        .eq("id", profileId);

      if (updateError) throw updateError;

      // Delete old avatar if exists
      if (currentAvatarUrl && currentAvatarUrl.includes("/avatars/")) {
        const oldPath = currentAvatarUrl.split("/avatars/")[1];
        if (oldPath && oldPath.includes("instagram-profiles")) {
          await supabase.storage.from("avatars").remove([oldPath]);
        }
      }

      onAvatarChange(publicUrl);
      toast.success("Foto de perfil atualizada com sucesso!");
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
      // Delete from storage only if it's our uploaded file
      if (currentAvatarUrl.includes("/avatars/instagram-profiles/")) {
        const filePath = currentAvatarUrl.split("/avatars/")[1];
        if (filePath) {
          await supabase.storage.from("avatars").remove([filePath]);
        }
      }

      // Update instagram_profiles record
      const { error } = await supabase
        .from("instagram_profiles")
        .update({ profile_picture_url: null })
        .eq("id", profileId);

      if (error) throw error;

      onAvatarChange(null);
      toast.success("Foto de perfil removida com sucesso!");
      closeDialog();
    } catch (error: any) {
      console.error("Error removing avatar:", error);
      toast.error(error.message || "Erro ao remover foto");
    } finally {
      setUploading(false);
    }
  };

  const closeDialog = () => {
    onOpenChange(false);
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
    setIsDragging(false);
  };

  return (
    <Dialog open={open} onOpenChange={(openState) => !openState && closeDialog()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Foto do perfil @{username}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {imageSrc ? (
            <>
              {/* Crop area */}
              <div className="relative h-72 bg-muted rounded-lg overflow-hidden">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              {/* Controls */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Slider
                    value={[zoom]}
                    onValueChange={([value]) => setZoom(value)}
                    min={1}
                    max={3}
                    step={0.1}
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <RotateCw className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Slider
                    value={[rotation]}
                    onValueChange={([value]) => setRotation(value)}
                    min={0}
                    max={360}
                    step={1}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setImageSrc(null);
                    setCrop({ x: 0, y: 0 });
                    setZoom(1);
                    setRotation(0);
                  }}
                  disabled={uploading}
                >
                  Trocar imagem
                </Button>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </div>
            </>
          ) : (
            <>
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
                <div className="flex flex-col items-center gap-3">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 p-[2px]">
                    <div className="h-full w-full rounded-full bg-background flex items-center justify-center">
                      <Camera className="h-7 w-7 text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Arraste uma imagem ou clique para selecionar</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      PNG, JPG até 10MB
                    </p>
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleInputChange}
                className="hidden"
              />

              {/* Remove button */}
              {currentAvatarUrl && (
                <div className="flex justify-end">
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
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
