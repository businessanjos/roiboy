import { useState } from "react";
import { Talent, useContentPieces, useUpsertPiece, PLATFORMS, PIECE_STATUSES, ContentPiece } from "@/hooks/useContentHQ";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContentHQPieceDrawer } from "./ContentHQPieceDrawer";
import { STAGE_CHECKLISTS } from "./contentHQTemplates";
import { CheckCircle2 } from "lucide-react";

export function ContentHQKanban({ talents, selectedTalentId, platformFilter }: { talents: Talent[]; selectedTalentId?: string; platformFilter?: string }) {
  const targets = selectedTalentId ? talents.filter(t => t.id === selectedTalentId) : talents;
  const queries = targets.map(t => useContentPieces(t.id));
  const allPieces = queries
    .flatMap((q, i) => (q.data || []).map(p => ({ ...p, talentName: targets[i].name, _talent: targets[i] })))
    .filter(p => !platformFilter || p.platform === platformFilter);
  const upsert = useUpsertPiece();
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = allPieces.find(p => p.id === openId) || null;

  const onDragStart = (e: React.DragEvent, id: string) => e.dataTransfer.setData("text/plain", id);
  const onDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const p = allPieces.find(x => x.id === id);
    if (p && p.status !== status) upsert.mutate({ id: p.id, talent_id: p.talent_id, title: p.title, platform: p.platform, status } as any);
  };

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-flow-col auto-cols-[280px] gap-3 pb-3">
        {PIECE_STATUSES.map(s => {
          const items = allPieces.filter(p => p.status === s.id);
          const total = STAGE_CHECKLISTS[s.id]?.length || 0;
          return (
            <Card key={s.id} className="p-3 bg-muted/30" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, s.id)}>
              <div className="flex items-center justify-between mb-3">
                <Badge variant="outline" className={s.color}>{s.label}</Badge>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {items.map(p => {
                  const pl = PLATFORMS.find(x => x.id === p.platform);
                  const checks = (p.briefing as any)?.checklist?.[p.status] || {};
                  const done = Object.values(checks).filter(Boolean).length;
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, p.id)}
                      onClick={() => setOpenId(p.id)}
                      className="bg-background p-2.5 rounded border cursor-pointer hover:border-primary transition-colors"
                    >
                      <div className="text-sm font-medium line-clamp-2">{p.title}</div>
                      <div className="flex items-center justify-between mt-1.5 gap-2">
                        <Badge variant="outline" className={`${pl?.color} text-[10px]`}>{pl?.label}</Badge>
                        <span className="text-[10px] text-muted-foreground truncate">{p.talentName}</span>
                      </div>
                      {total > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{done}/{total}</span>
                          {p.scheduled_date && <span className="ml-auto">{new Date(p.scheduled_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <ContentHQPieceDrawer
        piece={opened as ContentPiece | null}
        talent={opened?._talent || null}
        open={!!opened}
        onOpenChange={(v) => !v && setOpenId(null)}
      />
    </div>
  );
}
