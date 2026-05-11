import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Instagram, Users2, Heart, MessageCircle, BadgeCheck, ExternalLink, Trophy, Medal, Award, Search, TrendingUp, RefreshCw, Loader2, Clock } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EvolutionTrendsSection } from "@/components/instagram/EvolutionTrendsSection";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Snap = {
  client_id: string;
  username: string;
  full_name: string | null;
  profile_pic_url: string | null;
  is_verified: boolean | null;
  followers_count: number | null;
  media_count: number | null;
  posts: any;
  last_synced_at: string | null;
};

type Row = Snap & {
  total_likes: number;
  total_comments: number;
  avg_likes: number;
  avg_comments: number;
  posts_considered: number;
};

const ALLOWED_KEYS = ["maikol", "bruna", "everton", "jonathan", "andreia"];

const fmt = (n: number | null | undefined) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(".0", "") + "K";
  return v.toLocaleString("pt-BR");
};

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-zinc-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-700" />;
  return <span className="text-sm font-semibold text-muted-foreground tabular-nums w-5 text-center">{rank}</span>;
}

/**
 * Avatar com cascata de fallback:
 * 1) URL principal (cache no Storage ou CDN do Instagram)
 * 2) Proxy público unavatar.io por username
 * 3) Letra inicial via AvatarFallback
 */
function InstagramAvatar({
  primary,
  username,
  className,
}: {
  primary?: string | null;
  username?: string | null;
  className?: string;
}) {
  const sources = useMemo(() => {
    const list: string[] = [];
    if (primary) list.push(primary);
    if (username) {
      const u = username.replace(/^@/, "").trim();
      if (u) {
        list.push(`https://unavatar.io/instagram/${encodeURIComponent(u)}?fallback=false`);
        list.push(`https://unavatar.io/${encodeURIComponent(u)}?fallback=false`);
      }
    }
    return list;
  }, [primary, username]);

  const [idx, setIdx] = useState(0);
  // Reset quando username/primary mudam
  useEffect(() => { setIdx(0); }, [primary, username]);

  const current = sources[idx];

  return (
    <Avatar className={className}>
      {current && (
        <AvatarImage
          key={current}
          src={current}
          alt={username || ""}
          onError={() => setIdx((i) => i + 1)}
        />
      )}
      <AvatarFallback>{username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
    </Avatar>
  );
}
  rank: number;
  row: Row;
  metric: "followers" | "likes" | "comments";
  value: number;
  sublabel?: string;
}) {
  const Icon = metric === "followers" ? Users2 : metric === "likes" ? Heart : MessageCircle;
  const accent =
    metric === "followers" ? "text-fuchsia-500" :
    metric === "likes" ? "text-rose-500" :
    "text-sky-500";

  return (
    <Link
      to={`/clients/${row.client_id}?tab=instagram`}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors border border-transparent hover:border-border"
    >
      <div className="flex items-center justify-center w-7">
        <MedalIcon rank={rank} />
      </div>
      <InstagramAvatar
        primary={row.profile_pic_url}
        username={row.username}
        className="h-10 w-10 ring-2 ring-background shadow-sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-medium truncate">{row.full_name || row.username}</span>
          {row.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-sky-500 shrink-0" />}
        </div>
        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
          <span>@{row.username}</span>
          {sublabel && <span className="text-muted-foreground/60">• {sublabel}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end">
        <div className={`flex items-center gap-1.5 font-semibold tabular-nums ${accent}`}>
          <Icon className="h-3.5 w-3.5" />
          {fmt(value)}
        </div>
        <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-0.5" />
      </div>
    </Link>
  );
}

function RankList({ rows, metric, getValue, getSub }: {
  rows: Row[];
  metric: "followers" | "likes" | "comments";
  getValue: (r: Row) => number;
  getSub?: (r: Row) => string | undefined;
}) {
  const sorted = useMemo(
    () => [...rows].filter((r) => getValue(r) > 0).sort((a, b) => getValue(b) - getValue(a)),
    [rows, getValue],
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Sem dados para este ranking ainda. Sincronize o Instagram dos clientes para popular.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {sorted.map((row, idx) => (
        <RankRow
          key={row.client_id + row.username}
          rank={idx + 1}
          row={row}
          metric={metric}
          value={getValue(row)}
          sublabel={getSub?.(row)}
        />
      ))}
    </div>
  );
}

export default function InstagramRanking() {
  const { currentUser: user, loading: userLoading } = useCurrentUser();
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [period, setPeriod] = useState<"7" | "30" | "90" | "all">("all");
  const pollRef = useRef<number | null>(null);

  const periodSinceSec = useMemo(() => {
    if (period === "all") return null;
    const days = Number(period);
    return Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
  }, [period]);

  const allowed = useMemo(() => {
    if (!user) return false;
    const name = (user.name || "").toLowerCase();
    const email = (user.email || "").toLowerCase();
    if (user.role === "admin" || (user as any).is_also_admin) return true;
    return ALLOWED_KEYS.some((k) => name.includes(k) || email.includes(k));
  }, [user]);

  const loadRows = useCallback(async () => {
    const { data } = await supabase
      .from("client_instagram_snapshots" as any)
      .select("client_id, username, full_name, profile_pic_url, is_verified, followers_count, media_count, posts, last_synced_at")
      .order("last_synced_at", { ascending: false });

    const seen = new Set<string>();
    const dedup: Snap[] = [];
    let maxSync: string | null = null;
    for (const s of (data as any[]) || []) {
      if (s.last_synced_at && (!maxSync || s.last_synced_at > maxSync)) maxSync = s.last_synced_at;
      const key = s.client_id;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(s as Snap);
    }
    setSnaps(dedup);
    setLastSyncedAt(maxSync);
  }, []);

  // Compute Row[] dynamically based on period. Posts have a unix `taken_at` (seconds).
  const rows = useMemo<Row[]>(() => {
    const filterFn = (p: any): boolean => {
      if (periodSinceSec == null) return true;
      const t = Number(p?.taken_at);
      if (!Number.isFinite(t) || t <= 0) return false;
      return t >= periodSinceSec;
    };

    return snaps
      .map((s) => {
        const all: any[] = Array.isArray(s.posts) ? s.posts.slice(0, 12) : [];
        const considered = all.filter(filterFn);
        const total_likes = considered.reduce((acc, p) => acc + (Number(p?.like_count) || 0), 0);
        const total_comments = considered.reduce((acc, p) => acc + (Number(p?.comment_count) || 0), 0);
        const n = considered.length;
        return {
          ...s,
          total_likes,
          total_comments,
          avg_likes: n > 0 ? Math.round(total_likes / n) : 0,
          avg_comments: n > 0 ? Math.round(total_comments / n) : 0,
          posts_considered: n,
        };
      });
  }, [snaps, periodSinceSec]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadRows();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [allowed, loadRows]);

  // Poll while syncing so the user sees progress in near-real-time
  useEffect(() => {
    if (!syncing) return;
    pollRef.current = window.setInterval(() => { loadRows(); }, 5000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [syncing, loadRows]);

  const handleManualSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    toast.info("Sincronização iniciada", {
      description: "Pode levar alguns minutos. Os perfis aparecerão conforme forem atualizados.",
    });
    // Fire-and-forget: invoke roda no servidor; mantemos polling até concluir.
    supabase.functions
      .invoke("sync-eternum-club-instagram", { body: {} })
      .then(({ error }) => {
        if (error) {
          toast.error("Falha na sincronização", { description: error.message });
        } else {
          toast.success("Sincronização concluída");
        }
      })
      .catch((e: any) => {
        toast.error(e?.message || "Falha ao iniciar sincronização");
      })
      .finally(() => {
        loadRows();
        setSyncing(false);
      });
  }, [syncing, loadRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.username || "").toLowerCase().includes(q) ||
      (r.full_name || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  if (userLoading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>Esta área é visível apenas para a liderança autorizada.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const stats = useMemo(() => {
    const totalClients = filtered.length;
    const totalFollowers = filtered.reduce((a, r) => a + (r.followers_count || 0), 0);
    const totalLikes = filtered.reduce((a, r) => a + r.total_likes, 0);
    const totalComments = filtered.reduce((a, r) => a + r.total_comments, 0);
    return { totalClients, totalFollowers, totalLikes, totalComments };
  }, [filtered]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-fuchsia-500/10 via-rose-500/5 to-sky-500/10 p-6">
        <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-rose-500/30 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
              <Instagram className="h-4 w-4 text-fuchsia-500" />
              Ranking Instagram
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Quem brilha mais no Instagram
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              Os maiores perfis dos nossos clientes em seguidores, curtidas e comentários — atualizado a partir das sincronizações.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className="gap-1 bg-background/60 backdrop-blur">
              <TrendingUp className="h-3.5 w-3.5" />
              Acesso restrito
            </Badge>
            <Button
              onClick={handleManualSync}
              disabled={syncing}
              size="sm"
              className="gap-2 bg-gradient-to-r from-fuchsia-500 to-rose-500 hover:from-fuchsia-600 hover:to-rose-600 text-white border-0 shadow-md"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? "Sincronizando…" : "Atualizar agora"}
            </Button>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {lastSyncedAt
                ? `Última atualização: ${formatDistanceToNow(new Date(lastSyncedAt), { locale: ptBR, addSuffix: true })}`
                : "Sem sincronizações ainda"}
            </div>
          </div>
        </div>

        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <div className="rounded-xl bg-background/70 backdrop-blur border p-3">
            <div className="text-xs text-muted-foreground">Perfis</div>
            <div className="text-xl font-semibold tabular-nums">{fmt(stats.totalClients)}</div>
          </div>
          <div className="rounded-xl bg-background/70 backdrop-blur border p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Users2 className="h-3 w-3" /> Seguidores</div>
            <div className="text-xl font-semibold tabular-nums text-fuchsia-600 dark:text-fuchsia-400">{fmt(stats.totalFollowers)}</div>
          </div>
          <div className="rounded-xl bg-background/70 backdrop-blur border p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Heart className="h-3 w-3" /> Curtidas</div>
            <div className="text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">{fmt(stats.totalLikes)}</div>
          </div>
          <div className="rounded-xl bg-background/70 backdrop-blur border p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><MessageCircle className="h-3 w-3" /> Comentários</div>
            <div className="text-xl font-semibold tabular-nums text-sky-600 dark:text-sky-400">{fmt(stats.totalComments)}</div>
          </div>
        </div>
      </div>

      {syncing && (
        <div className="rounded-xl border bg-gradient-to-r from-fuchsia-500/10 to-rose-500/10 px-4 py-3 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-fuchsia-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Sincronizando perfis do Eternum Club…</div>
            <div className="text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? "perfil sincronizado" : "perfis sincronizados"} até agora. Os rankings vão sendo atualizados em tempo real.
            </div>
          </div>
          <div className="relative h-1.5 w-32 overflow-hidden rounded-full bg-background/60">
            <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-fuchsia-500 to-rose-500 animate-pulse rounded-full" />
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="relative md:max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por @ ou nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden md:inline">Período:</span>
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(v) => v && setPeriod(v as any)}
            className="bg-muted/40 rounded-lg p-1"
          >
            <ToggleGroupItem value="7" className="h-8 px-3 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
              7 dias
            </ToggleGroupItem>
            <ToggleGroupItem value="30" className="h-8 px-3 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
              30 dias
            </ToggleGroupItem>
            <ToggleGroupItem value="90" className="h-8 px-3 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
              90 dias
            </ToggleGroupItem>
            <ToggleGroupItem value="all" className="h-8 px-3 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
              Tudo
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {period !== "all" && (
        <div className="text-xs text-muted-foreground -mt-3">
          Curtidas e comentários consideram apenas posts publicados nos últimos {period} dias. Seguidores refletem o snapshot mais recente.
        </div>
      )}

      {loading ? (
        <Card><CardContent className="p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </CardContent></Card>
      ) : (
        <Tabs defaultValue="followers" className="w-full">
          <TabsList className="grid grid-cols-3 w-full md:w-auto md:inline-flex">
            <TabsTrigger value="followers" className="gap-2"><Users2 className="h-4 w-4" /> Seguidores</TabsTrigger>
            <TabsTrigger value="likes" className="gap-2"><Heart className="h-4 w-4" /> Curtidas</TabsTrigger>
            <TabsTrigger value="comments" className="gap-2"><MessageCircle className="h-4 w-4" /> Comentários</TabsTrigger>
          </TabsList>

          <TabsContent value="followers" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Users2 className="h-4 w-4 text-fuchsia-500" /> Mais seguidores</CardTitle>
                <CardDescription>Ranking pelo total de seguidores no perfil.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <RankList
                  rows={filtered}
                  metric="followers"
                  getValue={(r) => r.followers_count || 0}
                  getSub={(r) => `${fmt(r.media_count || 0)} posts`}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="likes" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Heart className="h-4 w-4 text-rose-500" /> Mais curtidas</CardTitle>
                <CardDescription>Soma de curtidas nos últimos posts sincronizados.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <RankList
                  rows={filtered}
                  metric="likes"
                  getValue={(r) => r.total_likes}
                  getSub={(r) => `média ${fmt(r.avg_likes)} • ${r.posts_considered} posts`}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comments" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="h-4 w-4 text-sky-500" /> Mais comentários</CardTitle>
                <CardDescription>Soma de comentários nos últimos posts sincronizados.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <RankList
                  rows={filtered}
                  metric="comments"
                  getValue={(r) => r.total_comments}
                  getSub={(r) => `média ${fmt(r.avg_comments)} • ${r.posts_considered} posts`}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!loading && (
        <EvolutionTrendsSection
          allowedClientIds={new Set(filtered.map((r) => r.client_id))}
        />
      )}
    </div>
  );
}
