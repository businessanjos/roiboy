import { Talent, useContentPieces, PIECE_STATUSES, PLATFORMS } from "@/hooks/useContentHQ";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ContentHQPerformance({ talent }: { talent: Talent }) {
  const { data: pieces = [] } = useContentPieces(talent.id);
  const published = pieces.filter(p => p.status === "published").length;
  const planned = pieces.length;
  const rate = planned ? Math.round((published / planned) * 100) : 0;

  const byPlatform = PLATFORMS.map(pl => ({ ...pl, count: pieces.filter(p => p.platform === pl.id).length }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Planejado</div><div className="text-2xl font-bold">{planned}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Publicado</div><div className="text-2xl font-bold text-emerald-600">{published}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Taxa de execução</div><div className="text-2xl font-bold">{rate}%</div></Card>
      </div>
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Distribuição por plataforma</h3>
        <div className="flex flex-wrap gap-2">
          {byPlatform.map(p => <Badge key={p.id} variant="outline" className={p.color}>{p.label}: {p.count}</Badge>)}
        </div>
      </Card>
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Status</h3>
        <div className="flex flex-wrap gap-2">
          {PIECE_STATUSES.map(s => <Badge key={s.id} variant="outline" className={s.color}>{s.label}: {pieces.filter(p => p.status === s.id).length}</Badge>)}
        </div>
      </Card>
      <p className="text-xs text-muted-foreground">Métricas reais por plataforma (views, likes, alcance) virão na próxima iteração, integrando com Instagram, TikTok e YouTube já conectados.</p>
    </div>
  );
}
