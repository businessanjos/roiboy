import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Download, Image as ImageIcon, Video, Lock } from "lucide-react";

interface Album {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  allow_public_download: boolean;
  event_id: string;
}

interface MediaItem {
  id: string;
  media_type: string;
  file_url: string;
  file_name: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

interface EventInfo {
  title: string;
  scheduled_at: string | null;
  address: string | null;
}


export default function PublicEventAlbum() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [album, setAlbum] = useState<Album | null>(null);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    load();
  }, [token]);

  const load = async () => {
    setLoading(true);
    const { data: albumData, error } = await supabase
      .from("event_media_albums")
      .select("id, name, description, cover_url, is_public, allow_public_download, event_id")
      .eq("public_token", token!)
      .eq("is_public", true)
      .maybeSingle();

    if (error || !albumData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setAlbum(albumData as Album);

    const [mediaRes, eventRes] = await Promise.all([
      supabase
        .from("event_media")
        .select("id, media_type, file_url, file_name, caption, thumbnail_url, created_at")
        .eq("album_id", albumData.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("events")
        .select("name, event_date, location")
        .eq("id", albumData.event_id)
        .maybeSingle(),
    ]);

    setMedia((mediaRes.data as MediaItem[]) || []);
    setEvent((eventRes.data as EventInfo) || null);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Carregando galeria...</div>
      </div>
    );
  }

  if (notFound || !album) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-semibold">Galeria indisponível</h1>
            <p className="text-sm text-muted-foreground">
              Este link expirou ou a galeria não está mais pública.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const photos = media.filter((m) => m.media_type === "photo");
  const videos = media.filter((m) => m.media_type === "video");

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
          <Badge variant="secondary" className="mb-3">
            Galeria do evento
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {event?.name || album.name}
          </h1>
          {event && (
            <div className="text-muted-foreground mt-2 text-sm flex flex-wrap gap-x-4">
              {event.event_date && (
                <span>
                  {new Date(event.event_date).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
              {event.location && <span>{event.location}</span>}
            </div>
          )}
          {album.description && (
            <p className="mt-4 text-sm text-muted-foreground max-w-2xl">
              {album.description}
            </p>
          )}
          <div className="mt-4 flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ImageIcon className="h-3.5 w-3.5" /> {photos.length} fotos
            </span>
            <span className="flex items-center gap-1">
              <Video className="h-3.5 w-3.5" /> {videos.length} vídeos
            </span>
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {media.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Nenhuma foto ou vídeo publicado ainda.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {media.map((m) => (
              <button
                key={m.id}
                onClick={() => setLightbox(m)}
                className="group relative aspect-square overflow-hidden rounded-lg bg-muted hover:opacity-90 transition"
              >
                {m.media_type === "video" ? (
                  <>
                    <video
                      src={m.file_url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Video className="h-8 w-8 text-white" />
                    </div>
                  </>
                ) : (
                  <img
                    src={m.thumbnail_url || m.file_url}
                    alt={m.caption || m.file_name || ""}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center py-6 text-xs text-muted-foreground">
        Galeria compartilhada com você
      </footer>

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden bg-background">
          {lightbox && (
            <div className="flex flex-col">
              <div className="bg-black flex items-center justify-center max-h-[80vh]">
                {lightbox.media_type === "video" ? (
                  <video
                    src={lightbox.file_url}
                    controls
                    autoPlay
                    className="max-h-[80vh] w-auto"
                  />
                ) : (
                  <img
                    src={lightbox.file_url}
                    alt={lightbox.caption || ""}
                    className="max-h-[80vh] w-auto object-contain"
                  />
                )}
              </div>
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="text-sm truncate">
                  {lightbox.caption || lightbox.file_name || ""}
                </div>
                {album.allow_public_download && (
                  <Button asChild variant="outline" size="sm">
                    <a href={lightbox.file_url} download target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Baixar
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
