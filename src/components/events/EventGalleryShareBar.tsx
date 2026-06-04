import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Share2, Copy, Check, Globe, Lock, ExternalLink } from "lucide-react";

interface Props {
  eventId: string;
  accountId: string | null;
  eventName?: string | null;
}

interface Album {
  id: string;
  name: string;
  is_public: boolean;
  public_token: string | null;
  allow_public_download: boolean;
}

function genToken() {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

export default function EventGalleryShareBar({ eventId, accountId, eventName }: Props) {
  const { toast } = useToast();
  const { currentUser } = useCurrentUser();
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (eventId) load();
  }, [eventId]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("event_media_albums")
      .select("id, name, is_public, public_token, allow_public_download")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    setAlbum((data as Album) || null);
    setLoading(false);
  };

  const ensureAlbum = async (): Promise<Album | null> => {
    if (album) return album;
    if (!accountId || !currentUser) return null;
    const token = genToken();
    const { data, error } = await supabase
      .from("event_media_albums")
      .insert({
        event_id: eventId,
        account_id: accountId,
        name: eventName ? `Galeria - ${eventName}` : "Galeria do Evento",
        is_public: false,
        public_token: token,
        allow_public_download: true,
        created_by: currentUser.id,
      })
      .select("id, name, is_public, public_token, allow_public_download")
      .single();
    if (error) {
      toast({ title: "Erro ao criar álbum", description: error.message, variant: "destructive" });
      return null;
    }
    // Link all existing event_media to this album
    await supabase
      .from("event_media")
      .update({ album_id: data.id })
      .eq("event_id", eventId)
      .is("album_id", null);
    setAlbum(data as Album);
    return data as Album;
  };

  const togglePublic = async (checked: boolean) => {
    setWorking(true);
    const a = await ensureAlbum();
    if (!a) {
      setWorking(false);
      return;
    }
    const { error } = await supabase
      .from("event_media_albums")
      .update({ is_public: checked })
      .eq("id", a.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setAlbum({ ...a, is_public: checked });
      toast({
        title: checked ? "Galeria pública ativada" : "Galeria fechada",
        description: checked
          ? "Qualquer pessoa com o link pode visualizar"
          : "O link público foi desativado",
      });
      // Make sure all current media is linked when going public
      if (checked) {
        await supabase
          .from("event_media")
          .update({ album_id: a.id })
          .eq("event_id", eventId)
          .is("album_id", null);
      }
    }
    setWorking(false);
  };

  const toggleDownload = async (checked: boolean) => {
    if (!album) return;
    const { error } = await supabase
      .from("event_media_albums")
      .update({ allow_public_download: checked })
      .eq("id", album.id);
    if (!error) setAlbum({ ...album, allow_public_download: checked });
  };

  const copyLink = async () => {
    if (!album?.public_token) return;
    const url = `${window.location.origin}/public/event-album/${album.public_token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "Link copiado" });
    setTimeout(() => setCopied(false), 2000);
  };

  const openLink = () => {
    if (!album?.public_token) return;
    window.open(`/public/event-album/${album.public_token}`, "_blank");
  };

  if (loading) return null;

  const isPublic = !!(album?.is_public && album?.public_token);

  return (
    <Card className={isPublic ? "border-emerald-500/40 bg-emerald-500/5" : ""}>
      <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {isPublic ? (
            <Globe className="h-5 w-5 text-emerald-600" />
          ) : (
            <Lock className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <div className="font-medium flex items-center gap-2">
              Galeria compartilhável
              {isPublic && (
                <Badge variant="secondary" className="bg-emerald-500 text-white border-0">
                  Pública
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isPublic
                ? "Participantes podem ver e baixar as fotos/vídeos pelo link"
                : "Ative para gerar um link público dessa galeria"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isPublic && (
            <div className="flex items-center gap-2">
              <Switch
                id="allow-dl"
                checked={!!album?.allow_public_download}
                onCheckedChange={toggleDownload}
              />
              <Label htmlFor="allow-dl" className="text-xs cursor-pointer">
                Permitir download
              </Label>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch
              id="public-toggle"
              checked={isPublic}
              disabled={working}
              onCheckedChange={togglePublic}
            />
            <Label htmlFor="public-toggle" className="text-xs cursor-pointer">
              Público
            </Label>
          </div>
          {isPublic && (
            <>
              <Button size="sm" variant="outline" onClick={copyLink}>
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
                  </>
                )}
              </Button>
              <Button size="sm" variant="outline" onClick={openLink}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Abrir
              </Button>
            </>
          )}
          {!isPublic && (
            <Button
              size="sm"
              variant="default"
              disabled={working}
              onClick={() => togglePublic(true)}
            >
              <Share2 className="h-3.5 w-3.5 mr-1" />
              Compartilhar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
