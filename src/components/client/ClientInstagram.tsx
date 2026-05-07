import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw, Instagram, ExternalLink, Heart, MessageCircle, Play, BadgeCheck, Lock } from "lucide-react";
import { toast } from "sonner";

interface IGPost {
  id?: string;
  code?: string;
  taken_at?: number;
  like_count?: number | null;
  comment_count?: number | null;
  play_count?: number | null;
  media_type?: number;
  product_type?: string;
  caption?: string | null;
  thumbnail_url?: string | null;
  url?: string | null;
}

interface IGSnapshot {
  id?: string;
  username: string;
  full_name?: string | null;
  biography?: string | null;
  profile_pic_url?: string | null;
  external_url?: string | null;
  is_verified?: boolean;
  is_private?: boolean;
  is_business?: boolean;
  category?: string | null;
  followers_count: number;
  following_count: number;
  media_count: number;
  posts: IGPost[];
  last_synced_at?: string;
}

const fmt = (n: number) => {
  if (!n && n !== 0) return "-";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".0", "") + "K";
  return n.toLocaleString("pt-BR");
};

export function ClientInstagram({ clientId, initialUsername }: { clientId: string; initialUsername?: string | null }) {
  const [username, setUsername] = useState<string>((initialUsername || "").replace(/^@/, ""));
  const [snapshot, setSnapshot] = useState<IGSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadCached = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("client_instagram_snapshots" as any)
      .select("*")
      .eq("client_id", clientId)
      .order("last_synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setSnapshot(data as any);
      if (!username && (data as any).username) setUsername((data as any).username);
    }
    setLoading(false);
  };

  useEffect(() => { loadCached(); /* eslint-disable-next-line */ }, [clientId]);

  const sync = async () => {
    const u = username.trim().replace(/^@/, "");
    if (!u) { toast.error("Informe o @ do Instagram"); return; }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-public-snapshot", {
        body: { username: u, clientId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setSnapshot((data as any).snapshot);
      toast.success("Instagram sincronizado");
      // also persist username to client.instagram if empty
      await supabase.from("clients").update({ instagram: u }).eq("id", clientId);
      await loadCached();
    } catch (e: any) {
      toast.error(e.message || "Falha ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Instagram className="h-4 w-4" />
          Instagram do cliente
        </CardTitle>
        <CardDescription>
          Veja seguidores, bio e últimos posts a partir do @ público (atualizado sob demanda).
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-6">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-muted-foreground">@</span>
            <Input
              placeholder="usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="flex-1"
            />
          </div>
          <Button onClick={sync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
            </div>
          </div>
        ) : !snapshot ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhum snapshot ainda. Informe o @ acima e clique em Sincronizar.
          </div>
        ) : (
          <>
            {/* Profile header */}
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 p-[3px]">
                <Avatar className="h-full w-full border-2 border-card">
                  <AvatarImage src={snapshot.profile_pic_url || undefined} alt={snapshot.username} />
                  <AvatarFallback>{snapshot.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 text-center sm:text-left space-y-3">
                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                  <h3 className="text-lg font-semibold">@{snapshot.username}</h3>
                  {snapshot.is_verified && <BadgeCheck className="h-4 w-4 text-blue-500" />}
                  {snapshot.is_private && <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" />Privado</Badge>}
                  {snapshot.is_business && <Badge variant="secondary">Business</Badge>}
                  {snapshot.category && <Badge variant="outline">{snapshot.category}</Badge>}
                  <a href={`https://instagram.com/${snapshot.username}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-1.5 h-7">
                      <ExternalLink className="h-3.5 w-3.5" />Abrir
                    </Button>
                  </a>
                </div>
                {snapshot.full_name && <p className="text-sm font-medium">{snapshot.full_name}</p>}
                <div className="flex justify-center sm:justify-start gap-8">
                  <div><span className="font-bold">{fmt(snapshot.media_count)}</span> <span className="text-sm text-muted-foreground">publicações</span></div>
                  <div><span className="font-bold">{fmt(snapshot.followers_count)}</span> <span className="text-sm text-muted-foreground">seguidores</span></div>
                  <div><span className="font-bold">{fmt(snapshot.following_count)}</span> <span className="text-sm text-muted-foreground">seguindo</span></div>
                </div>
                {snapshot.biography && <p className="text-sm whitespace-pre-wrap text-muted-foreground max-w-xl">{snapshot.biography}</p>}
                {snapshot.external_url && (
                  <a href={snapshot.external_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    {snapshot.external_url}
                  </a>
                )}
                {snapshot.last_synced_at && (
                  <p className="text-xs text-muted-foreground">
                    Última sincronização: {new Date(snapshot.last_synced_at).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            </div>

            {/* Posts grid */}
            {snapshot.posts && snapshot.posts.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3">Últimos posts</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {snapshot.posts.map((p, idx) => (
                    <a
                      key={p.id || idx}
                      href={p.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
                    >
                      {p.thumbnail_url ? (
                        <img src={p.thumbnail_url} alt={p.caption?.slice(0, 80) || "post"} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sem prévia</div>
                      )}
                      {(p.media_type === 2 || p.product_type === "clips") && (
                        <Play className="absolute top-2 right-2 h-4 w-4 text-white drop-shadow" fill="white" />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white text-sm font-medium">
                        <span className="flex items-center gap-1"><Heart className="h-4 w-4" fill="white" />{fmt(p.like_count || 0)}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4" fill="white" />{fmt(p.comment_count || 0)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
