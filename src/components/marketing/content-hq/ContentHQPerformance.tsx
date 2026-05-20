import { useMemo, useState } from "react";
import { Talent, useContentPieces, PLATFORMS } from "@/hooks/useContentHQ";
import {
  PlatformAccount,
  usePlatformAccounts, usePlatformPosts, useLatestMetricsByPost, useLatestSnapshots,
  useUpsertPlatformAccount, useDeletePlatformAccount, syncPlatformAccount,
} from "@/hooks/useContentMetrics";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Link2, AlertCircle, Eye, Heart, MessageCircle, Share2, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const SUPPORTED = [
  { id: "instagram", label: "Instagram", help: "Conta Business/Creator vinculada a uma Página do Facebook. Informe o IG User ID e um Access Token de longa duração (Graph API v20)." },
  { id: "youtube", label: "YouTube", help: "Informe o Channel ID (UCxxxx) e uma API Key do YouTube Data API v3 (Google Cloud Console)." },
  { id: "tiktok", label: "TikTok", help: "Cole um Access Token OAuth do TikTok Display API com escopo video.list." },
];

function ConnectDialog({ talent, platform, account, open, onOpenChange }: {
  talent: Talent; platform: string; account: PlatformAccount | undefined;
  open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const upsert = useUpsertPlatformAccount();
  const [handle, setHandle] = useState(account?.handle || "");
  const [externalId, setExternalId] = useState(account?.external_id || "");
  const [accessToken, setAccessToken] = useState("");
  const cfg = SUPPORTED.find(p => p.id === platform)!;
  const needsExternal = platform !== "tiktok";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar {cfg?.label} — {talent.name}</DialogTitle>
          <DialogDescription>{cfg?.help}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Handle / @</Label><Input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@bruna" /></div>
          {needsExternal && (
            <div>
              <Label>{platform === "instagram" ? "IG Business User ID" : "Channel ID"}</Label>
              <Input value={externalId} onChange={e => setExternalId(e.target.value)} />
            </div>
          )}
          <div>
            <Label>{platform === "youtube" ? "API Key" : "Access Token"}</Label>
            <Input type="password" value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder={account?.access_token ? "•••• (atual mantido se vazio)" : ""} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={upsert.isPending}
            onClick={async () => {
              await upsert.mutateAsync({
                id: account?.id, talent_id: talent.id, platform,
                handle: handle || null, external_id: externalId || null,
                ...(accessToken ? { access_token: accessToken } : {}),
              } as any);
              onOpenChange(false);
            }}
          >Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlatformCard({ talent, platform, account }: { talent: Talent; platform: string; account?: PlatformAccount }) {
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const del = useDeletePlatformAccount();
  const qc = useQueryClient();
  const cfg = PLATFORMS.find(p => p.id === platform)!;

  const handleSync = async () => {
    if (!account) return;
    setSyncing(true);
    try {
      const res = await syncPlatformAccount([account.id]);
      const r = res?.results?.[0];
      if (r?.error) toast({ title: `Erro ${cfg.label}`, description: r.error, variant: "destructive" });
      else toast({ title: `${cfg.label} sincronizado`, description: `${r?.synced || 0} posts atualizados` });
      qc.invalidateQueries({ queryKey: ["platform-accounts"] });
      qc.invalidateQueries({ queryKey: ["platform-posts"] });
      qc.invalidateQueries({ queryKey: ["platform-snapshots"] });
    } catch (e: any) {
      toast({ title: "Falha no sync", description: e.message, variant: "destructive" });
    } finally { setSyncing(false); }
  };

  return (
    <Card className="p-3 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
          {account?.status === "connected" && <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30" variant="outline">conectado</Badge>}
          {account?.status === "error" && <Badge className="bg-red-500/15 text-red-700" variant="outline"><AlertCircle className="h-3 w-3 mr-1" />erro</Badge>}
          {!account && <Badge variant="outline">não conectado</Badge>}
        </div>
        <div className="text-xs text-muted-foreground mt-1 truncate">
          {account?.handle || "—"} {account?.last_sync_at && `· sync ${new Date(account.last_sync_at).toLocaleString("pt-BR")}`}
        </div>
        {account?.last_sync_error && <div className="text-xs text-red-600 mt-1 truncate">{account.last_sync_error}</div>}
      </div>
      <div className="flex items-center gap-1">
        {account && (
          <Button size="sm" variant="ghost" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Link2 className="h-4 w-4 mr-1" />{account ? "Editar" : "Conectar"}</Button>
        {account && <Button size="sm" variant="ghost" onClick={() => del.mutate(account.id)}>Remover</Button>}
      </div>
      <ConnectDialog talent={talent} platform={platform} account={account} open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function MetricsTab({ talent }: { talent: Talent }) {
  const { data: posts = [], isLoading: lp } = usePlatformPosts(talent.id);
  const { data: metricsMap } = useLatestMetricsByPost(posts.map(p => p.id));
  const { data: snapshotsMap } = useLatestSnapshots(talent.id);

  const totals = useMemo(() => {
    const acc = { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, posts: posts.length, engSum: 0, engCount: 0 };
    for (const p of posts) {
      const m = metricsMap?.get(p.id); if (!m) continue;
      acc.views += m.views || 0; acc.reach += m.reach || 0; acc.likes += m.likes || 0;
      acc.comments += m.comments || 0; acc.shares += m.shares || 0; acc.saves += m.saves || 0;
      if (m.engagement_rate != null) { acc.engSum += m.engagement_rate; acc.engCount++; }
    }
    return acc;
  }, [posts, metricsMap]);

  const byPlatform = useMemo(() => {
    const map = new Map<string, { posts: number; views: number; eng: number; rate: number; count: number }>();
    for (const p of posts) {
      const m = metricsMap?.get(p.id);
      const e = map.get(p.platform) || { posts: 0, views: 0, eng: 0, rate: 0, count: 0 };
      e.posts++;
      if (m) {
        e.views += m.views || 0;
        e.eng += (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saves || 0);
        if (m.engagement_rate != null) { e.rate += m.engagement_rate; e.count++; }
      }
      map.set(p.platform, e);
    }
    return map;
  }, [posts, metricsMap]);

  const topPosts = useMemo(() => {
    return [...posts]
      .map(p => ({ post: p, metric: metricsMap?.get(p.id) }))
      .filter(x => x.metric)
      .sort((a, b) => (b.metric!.views || 0) - (a.metric!.views || 0))
      .slice(0, 8);
  }, [posts, metricsMap]);

  if (lp) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando métricas...</div>;
  if (!posts.length) return <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum dado ainda. Conecte uma plataforma na aba "Conexões" e sincronize.</Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" /> Views</div><div className="text-2xl font-bold">{fmt(totals.views)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Alcance</div><div className="text-2xl font-bold">{fmt(totals.reach)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Heart className="h-3 w-3" /> Engajamento</div><div className="text-2xl font-bold">{fmt(totals.likes + totals.comments + totals.shares + totals.saves)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Eng. rate médio</div><div className="text-2xl font-bold">{totals.engCount ? ((totals.engSum / totals.engCount) * 100).toFixed(2) + "%" : "—"}</div></Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Seguidores por plataforma</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {PLATFORMS.filter(p => snapshotsMap?.get(p.id)).map(p => {
            const s = snapshotsMap!.get(p.id)!;
            return (
              <div key={p.id} className="flex items-center justify-between p-2 rounded border">
                <Badge variant="outline" className={p.color}>{p.label}</Badge>
                <div className="text-right">
                  <div className="text-lg font-bold">{fmt(s.followers)}</div>
                  {s.total_views != null && <div className="text-xs text-muted-foreground">{fmt(s.total_views)} views totais</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Por plataforma</h3>
        <div className="space-y-2">
          {Array.from(byPlatform.entries()).map(([pl, v]) => {
            const cfg = PLATFORMS.find(p => p.id === pl)!;
            return (
              <div key={pl} className="grid grid-cols-5 gap-2 items-center text-sm py-1 border-b last:border-0">
                <Badge variant="outline" className={cfg?.color}>{cfg?.label || pl}</Badge>
                <div><span className="text-muted-foreground">Posts:</span> <strong>{v.posts}</strong></div>
                <div><span className="text-muted-foreground">Views:</span> <strong>{fmt(v.views)}</strong></div>
                <div><span className="text-muted-foreground">Eng:</span> <strong>{fmt(v.eng)}</strong></div>
                <div><span className="text-muted-foreground">ER:</span> <strong>{v.count ? ((v.rate / v.count) * 100).toFixed(2) + "%" : "—"}</strong></div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Top 8 posts (por views)</h3>
        <div className="space-y-2">
          {topPosts.map(({ post, metric }) => {
            const cfg = PLATFORMS.find(p => p.id === post.platform)!;
            return (
              <a key={post.id} href={post.url || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 border">
                {post.thumbnail_url && <img src={post.thumbnail_url} className="w-12 h-12 object-cover rounded" alt="" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cfg?.color}>{cfg?.label}</Badge>
                    {post.published_at && <span className="text-xs text-muted-foreground">{new Date(post.published_at).toLocaleDateString("pt-BR")}</span>}
                  </div>
                  <div className="text-sm truncate">{post.caption || "(sem legenda)"}</div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{fmt(metric!.views)}</span>
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{fmt(metric!.likes)}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{fmt(metric!.comments)}</span>
                  <span className="flex items-center gap-1"><Share2 className="h-3 w-3" />{fmt(metric!.shares)}</span>
                </div>
              </a>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export function ContentHQPerformance({ talent }: { talent: Talent }) {
  const { data: pieces = [] } = useContentPieces(talent.id);
  const { data: accounts = [] } = usePlatformAccounts(talent.id);
  const [tab, setTab] = useState("metrics");
  const [syncingAll, setSyncingAll] = useState(false);
  const qc = useQueryClient();

  const connected = accounts.filter(a => a.status === "connected");
  const published = pieces.filter(p => p.status === "published").length;
  const planned = pieces.length;
  const rate = planned ? Math.round((published / planned) * 100) : 0;

  const syncAll = async () => {
    if (!connected.length) return;
    setSyncingAll(true);
    try {
      await syncPlatformAccount(connected.map(a => a.id));
      qc.invalidateQueries({ queryKey: ["platform-accounts"] });
      qc.invalidateQueries({ queryKey: ["platform-posts"] });
      qc.invalidateQueries({ queryKey: ["platform-snapshots"] });
      toast({ title: "Sincronização concluída" });
    } catch (e: any) {
      toast({ title: "Falha", description: e.message, variant: "destructive" });
    } finally { setSyncingAll(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Planejado</div><div className="text-2xl font-bold">{planned}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Publicado</div><div className="text-2xl font-bold text-emerald-600">{published}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Taxa de execução</div><div className="text-2xl font-bold">{rate}%</div></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="metrics">Métricas reais</TabsTrigger>
            <TabsTrigger value="connections">Conexões ({connected.length}/3)</TabsTrigger>
          </TabsList>
          {connected.length > 0 && tab === "metrics" && (
            <Button size="sm" variant="outline" onClick={syncAll} disabled={syncingAll}>
              {syncingAll ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Sincronizar todas
            </Button>
          )}
        </div>

        <TabsContent value="metrics" className="mt-3">
          <MetricsTab talent={talent} />
        </TabsContent>

        <TabsContent value="connections" className="mt-3 space-y-2">
          {SUPPORTED.map(s => {
            const acc = accounts.find(a => a.platform === s.id);
            return <PlatformCard key={s.id} talent={talent} platform={s.id} account={acc} />;
          })}
          <p className="text-xs text-muted-foreground pt-2">
            Tokens são armazenados criptografados na sua conta. Para Instagram use o IG Business User ID + access_token de longa duração (Meta Graph v20). YouTube usa Channel ID + API Key (Google Cloud). TikTok usa access_token OAuth (Display API).
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
