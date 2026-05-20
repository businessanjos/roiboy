import { Talent, useContentPieces, useUpsertPiece, PLATFORMS, PIECE_STATUSES } from "@/hooks/useContentHQ";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ContentHQKanban({ talents, selectedTalentId }: { talents: Talent[]; selectedTalentId?: string }) {
  const targets = selectedTalentId ? talents.filter(t => t.id === selectedTalentId) : talents;
  const queries = targets.map(t => useContentPieces(t.id));
  const allPieces = queries.flatMap((q, i) => (q.data || []).map(p => ({ ...p, talentName: targets[i].name })));
  const upsert = useUpsertPiece();

  const onDragStart = (e: React.DragEvent, id: string) => e.dataTransfer.setData("text/plain", id);
  const onDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const p = allPieces.find(x => x.id === id);
    if (p && p.status !== status) upsert.mutate({ id: p.id, talent_id: p.talent_id, title: p.title, platform: p.platform, status } as any);
  };

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-flow-col auto-cols-[260px] gap-3 pb-3">
        {PIECE_STATUSES.map(s => {
          const items = allPieces.filter(p => p.status === s.id);
          return (
            <Card key={s.id} className="p-3 bg-muted/30" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, s.id)}>
              <div className="flex items-center justify-between mb-3">
                <Badge variant="outline" className={s.color}>{s.label}</Badge>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {items.map(p => {
                  const pl = PLATFORMS.find(x => x.id === p.platform);
                  return (
                    <div key={p.id} draggable onDragStart={(e) => onDragStart(e, p.id)} className="bg-background p-2.5 rounded border cursor-move hover:border-primary">
                      <div className="text-sm font-medium line-clamp-2">{p.title}</div>
                      <div className="flex items-center justify-between mt-1.5">
                        <Badge variant="outline" className={`${pl?.color} text-[10px]`}>{pl?.label}</Badge>
                        <span className="text-[10px] text-muted-foreground">{p.talentName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
