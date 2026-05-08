import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Minus, Users2, Heart, MessageCircle, BadgeCheck, ArrowUpRight, LineChart as LineChartIcon } from "lucide-react";

type MetricKey = "followers" | "likes" | "comments";

interface HistoryRow {
  client_id: string;
  username: string;
  snapshot_at: string;
  followers_count: number | null;
  total_likes: number | null;
  total_comments: number | null;
}

interface ProfileMeta {
  client_id: string;
  username: string;
  full_name: string | null;
  profile_pic_url: string | null;
  is_verified: boolean | null;
}

type Series = { date: string; value: number };

interface ProfileEvolution {
  clientId: string;
  username: string;
  fullName: string | null;
  pic: string | null;
  verified: boolean;
  series: Record<MetricKey, Series[]>;
  current: Record<MetricKey, number>;
  delta: Record<MetricKey, number>;
  deltaPct: Record<MetricKey, number | null>;
  points: number;
}

const fmt = (n: number) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1).replace(".0", "") + "K";
  return v.toLocaleString("pt-BR");
};

const fmtSigned = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));

function TrendBadge({ value, pct }: { value: number; pct: number | null }) {
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  const cls =
    value > 0
      ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
      : value < 0
      ? "text-rose-600 bg-rose-500/10 border-rose-500/20"
      : "text-muted-foreground bg-muted border-border";
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-medium ${cls}`}>
      <Icon className="h-3 w-3" />
      {fmtSigned(value)}
      {pct != null && Number.isFinite(pct) && (
        <span className="opacity-70">({pct > 0 ? "+" : ""}{pct.toFixed(1)}%)</span>
      )}
    </span>
  );
}

const sparkColor: Record<MetricKey, string> = {
  followers: "#d946ef", // fuchsia-500
  likes: "#f43f5e", // rose-500
  comments: "#0ea5e9", // sky-500
};

function Sparkline({ data, metric }: { data: Series[]; metric: MetricKey }) {
  if (data.length < 2) {
    return (
      <div className="h-10 w-28 flex items-center justify-center text-[10px] text-muted-foreground/60">
        sem evolução
      </div>
    );
  }
  return (
    <div className="h-10 w-28">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={sparkColor[metric]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 11,
              padding: "4px 6px",
            }}
            labelStyle={{ display: "none" }}
            formatter={(v: number) => [fmt(v), ""] as any}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const metricMeta: Record<MetricKey, { label: string; Icon: typeof Users2; tone: string }> = {
  followers: { label: "Seguidores", Icon: Users2, tone: "text-fuchsia-500" },
  likes: { label: "Curtidas", Icon: Heart, tone: "text-rose-500" },
  comments: { label: "Comentários", Icon: MessageCircle, tone: "text-sky-500" },
};

export function EvolutionTrendsSection({ allowedClientIds }: { allowedClientIds?: Set<string> }) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMeta>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: hist }, { data: snaps }] = await Promise.all([
        supabase
          .from("client_instagram_metrics_history" as any)
          .select("client_id, username, snapshot_at, followers_count, total_likes, total_comments")
          .order("snapshot_at", { ascending: true })
          .limit(2000),
        supabase
          .from("client_instagram_snapshots" as any)
          .select("client_id, username, full_name, profile_pic_url, is_verified")
          .order("last_synced_at", { ascending: false }),
      ]);

      const profMap: Record<string, ProfileMeta> = {};
      for (const p of (snaps as any[]) || []) {
        const key = `${p.client_id}__${p.username}`;
        if (!profMap[key]) profMap[key] = p as ProfileMeta;
      }

      if (!cancelled) {
        setHistory((hist as any) || []);
        setProfiles(profMap);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const evolutions = useMemo<ProfileEvolution[]>(() => {
    const groups = new Map<string, HistoryRow[]>();
    for (const h of history) {
      if (allowedClientIds && !allowedClientIds.has(h.client_id)) continue;
      const key = `${h.client_id}__${h.username}`;
      const arr = groups.get(key) || [];
      arr.push(h);
      groups.set(key, arr);
    }
    const out: ProfileEvolution[] = [];
    for (const [key, rows] of groups.entries()) {
      const meta = profiles[key];
      if (!meta) continue;
      const sorted = rows.sort((a, b) => a.snapshot_at.localeCompare(b.snapshot_at));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      const buildSeries = (k: keyof HistoryRow): Series[] =>
        sorted.map((r) => ({
          date: r.snapshot_at,
          value: Number((r as any)[k]) || 0,
        }));

      const series = {
        followers: buildSeries("followers_count"),
        likes: buildSeries("total_likes"),
        comments: buildSeries("total_comments"),
      };

      const current = {
        followers: Number(last.followers_count || 0),
        likes: Number(last.total_likes || 0),
        comments: Number(last.total_comments || 0),
      };
      const initial = {
        followers: Number(first.followers_count || 0),
        likes: Number(first.total_likes || 0),
        comments: Number(first.total_comments || 0),
      };
      const delta = {
        followers: current.followers - initial.followers,
        likes: current.likes - initial.likes,
        comments: current.comments - initial.comments,
      };
      const pct = (a: number, b: number): number | null =>
        b === 0 ? (a === 0 ? 0 : null) : ((a - b) / b) * 100;
      const deltaPct = {
        followers: pct(current.followers, initial.followers),
        likes: pct(current.likes, initial.likes),
        comments: pct(current.comments, initial.comments),
      };

      out.push({
        clientId: meta.client_id,
        username: meta.username,
        fullName: meta.full_name,
        pic: meta.profile_pic_url,
        verified: !!meta.is_verified,
        series,
        current,
        delta,
        deltaPct,
        points: sorted.length,
      });
    }
    return out;
  }, [history, profiles, allowedClientIds]);

  const renderRanking = (metric: MetricKey) => {
    const sorted = [...evolutions].sort((a, b) => b.delta[metric] - a.delta[metric]);
    const movers = sorted.filter((e) => e.delta[metric] !== 0);

    if (movers.length === 0) {
      return (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Aguardando o segundo registro de cada perfil para calcular tendências (atualizamos automaticamente a cada 30 dias).
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.slice(0, 20).map((e, idx) => {
          const M = metricMeta[metric];
          return (
            <Link
              key={e.clientId + e.username}
              to={`/clients/${e.clientId}?tab=instagram`}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-card hover:bg-muted/40 transition-colors"
            >
              <div className="text-xs font-semibold tabular-nums text-muted-foreground w-5 text-center">
                {idx + 1}
              </div>
              <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm shrink-0">
                <AvatarImage src={e.pic || undefined} alt={e.username} />
                <AvatarFallback>{e.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-medium truncate text-sm">{e.fullName || e.username}</span>
                  {e.verified && <BadgeCheck className="h-3.5 w-3.5 text-sky-500 shrink-0" />}
                </div>
                <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                  <span className={`inline-flex items-center gap-1 ${M.tone}`}>
                    <M.Icon className="h-3 w-3" /> {fmt(e.current[metric])}
                  </span>
                  <span>•</span>
                  <TrendBadge value={e.delta[metric]} pct={e.deltaPct[metric]} />
                </div>
              </div>
              <Sparkline data={e.series[metric]} metric={metric} />
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
            </Link>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  const hasAnyEvolution = evolutions.some((e) => e.points >= 2);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-fuchsia-500/5 via-rose-500/5 to-sky-500/5 border-b">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <LineChartIcon className="h-4 w-4 text-fuchsia-500" />
              Evolução & Tendências
            </CardTitle>
            <CardDescription>
              Quem mais cresceu (ou caiu) em seguidores, curtidas e comentários ao longo do tempo.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[11px]">
            {evolutions.filter((e) => e.points >= 2).length} de {evolutions.length} perfis com histórico
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {!hasAnyEvolution ? (
          <div className="text-center py-10 text-sm text-muted-foreground border border-dashed rounded-lg">
            <LineChartIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            Ainda só há um snapshot por perfil. A próxima sincronização (em 30 dias, ou manualmente)
            criará o primeiro ponto de comparação para gerar as tendências.
          </div>
        ) : (
          <Tabs defaultValue="followers">
            <TabsList className="grid grid-cols-3 w-full md:w-auto md:inline-flex mb-4">
              <TabsTrigger value="followers" className="gap-2"><Users2 className="h-4 w-4" /> Seguidores</TabsTrigger>
              <TabsTrigger value="likes" className="gap-2"><Heart className="h-4 w-4" /> Curtidas</TabsTrigger>
              <TabsTrigger value="comments" className="gap-2"><MessageCircle className="h-4 w-4" /> Comentários</TabsTrigger>
            </TabsList>
            <TabsContent value="followers">{renderRanking("followers")}</TabsContent>
            <TabsContent value="likes">{renderRanking("likes")}</TabsContent>
            <TabsContent value="comments">{renderRanking("comments")}</TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
