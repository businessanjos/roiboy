import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { 
  Plus, 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Trash2,
  Upload,
  Star,
  X
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Database } from "@/integrations/supabase/types";

type EventMediaType = Database["public"]["Enums"]["event_media_type"];

interface MediaItem {
  id: string;
  media_type: EventMediaType;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  thumbnail_url: string | null;
  caption: string | null;
  is_cover: boolean;
  display_order: number | null;
  created_at: string;
}

interface EventMediaTabProps {
  eventId: string;
  accountId: string | null;
}

const mediaTypeIcons: Record<EventMediaType, React.ElementType> = {
  photo: ImageIcon,
  video: Video,
  document: FileText,
  other: FileText,
};

export default function EventMediaTab({ eventId, accountId }: EventMediaTabProps) {
  const { toast } = useToast();
  const { currentUser } = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [editCaption, setEditCaption] = useState("");

  useEffect(() => {
    if (eventId) {
      fetchMedia();
    }
  }, [eventId]);

  const fetchMedia = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_media")
      .select("*")
      .eq("event_id", eventId)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching media:", error);
    } else {
      setMedia(data || []);
    }
    setLoading(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !accountId || !currentUser) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${eventId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // Determine media type
      let mediaType: EventMediaType = 'other';
      if (file.type.startsWith('image/')) mediaType = 'photo';
      else if (file.type.startsWith('video/')) mediaType = 'video';
      else if (file.type === 'application/pdf' || file.type.includes('document')) mediaType = 'document';

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('event-media')
        .upload(fileName, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast({ title: "Erro", description: `Falha ao enviar ${file.name}`, variant: "destructive" });
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('event-media')
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from("event_media")
        .insert({
          account_id: accountId,
          event_id: eventId,
          media_type: mediaType,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          uploaded_by: currentUser.id,
          display_order: media.length,
        });

      if (dbError) {
        console.error("Database error:", dbError);
        toast({ title: "Erro", description: `Falha ao salvar ${file.name}`, variant: "destructive" });
      }
    }

    setUploading(false);
    fetchMedia();
    toast({ title: "Upload concluído" });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const deleteMedia = async (item: MediaItem) => {
    // Extract file path from URL
    const urlParts = item.file_url.split('/event-media/');
    if (urlParts.length > 1) {
      await supabase.storage.from('event-media').remove([urlParts[1]]);
    }

    const { error } = await supabase
      .from("event_media")
      .delete()
      .eq("id", item.id);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível excluir a mídia", variant: "destructive" });
    } else {
      toast({ title: "Mídia excluída" });
      fetchMedia();
    }
  };

  const setCover = async (item: MediaItem) => {
    // First, unset all covers
    await supabase
      .from("event_media")
      .update({ is_cover: false })
      .eq("event_id", eventId);

    // Set new cover
    const { error } = await supabase
      .from("event_media")
      .update({ is_cover: true })
      .eq("id", item.id);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível definir como capa", variant: "destructive" });
    } else {
      toast({ title: "Capa definida" });
      fetchMedia();
    }
  };

  const openEditDialog = (item: MediaItem) => {
    setEditingMedia(item);
    setEditCaption(item.caption || "");
    setEditDialogOpen(true);
  };

  const saveCaption = async () => {
    if (!editingMedia) return;

    const { error } = await supabase
      .from("event_media")
      .update({ caption: editCaption || null })
      .eq("id", editingMedia.id);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível salvar a legenda", variant: "destructive" });
    } else {
      toast({ title: "Legenda salva" });
      setEditDialogOpen(false);
      fetchMedia();
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const photos = media.filter(m => m.media_type === 'photo');
  const videos = media.filter(m => m.media_type === 'video');
  const documents = media.filter(m => m.media_type === 'document' || m.media_type === 'other');

  return (
    <div className="space-y-6">
      {/* Upload Button */}
      <div className="flex justify-between items-center">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Enviando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Fazer Upload
            </>
          )}
        </Button>
        <p className="text-sm text-muted-foreground">
          {media.length} arquivo(s)
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : media.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Nenhuma mídia"
          description="Faça upload de fotos, vídeos ou documentos do evento."
          action={{
            label: "Fazer Upload",
            onClick: () => fileInputRef.current?.click()
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* Photos */}
          {photos.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Fotos ({photos.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {photos.map(item => (
                  <Card 
                    key={item.id} 
                    className={`relative group overflow-hidden cursor-pointer ${item.is_cover ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => { setSelectedMedia(item); setLightboxOpen(true); }}
                  >
                    <img
                      src={item.file_url}
                      alt={item.caption || item.file_name || ""}
                      className="aspect-square object-cover w-full"
                    />
                    {item.is_cover && (
                      <Badge className="absolute top-2 left-2 bg-primary">
                        <Star className="h-3 w-3 mr-1" /> Capa
                      </Badge>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => { e.stopPropagation(); openEditDialog(item); }}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => { e.stopPropagation(); setCover(item); }}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => { e.stopPropagation(); deleteMedia(item); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Videos */}
          {videos.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Video className="h-5 w-5" />
                Vídeos ({videos.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {videos.map(item => (
                  <Card key={item.id} className="overflow-hidden">
                    <video
                      src={item.file_url}
                      controls
                      className="w-full aspect-video"
                    />
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium truncate">{item.file_name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(item.file_size)}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteMedia(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {documents.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos ({documents.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {documents.map(item => (
                  <Card key={item.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <a 
                            href={item.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm font-medium hover:underline"
                          >
                            {item.file_name}
                          </a>
                          <p className="text-xs text-muted-foreground">{formatFileSize(item.file_size)}</p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteMedia(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && selectedMedia && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/10"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={selectedMedia.file_url}
            alt={selectedMedia.caption || ""}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {selectedMedia.caption && (
            <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white text-center bg-black/50 px-4 py-2 rounded">
              {selectedMedia.caption}
            </p>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Mídia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingMedia && (
              <img
                src={editingMedia.file_url}
                alt=""
                className="w-full max-h-48 object-contain rounded"
              />
            )}
            <div className="space-y-2">
              <Label>Legenda</Label>
              <Textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder="Adicione uma legenda..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveCaption}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}