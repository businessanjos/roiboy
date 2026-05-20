import { useMemo } from "react";
import { Talent, useContentPieces, PLATFORMS, PIECE_STATUSES, ContentPiece } from "@/hooks/useContentHQ";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Instagram, Youtube, Music2, MessageSquare, Linkedin, Image as ImageIcon, Headphones, CalendarDays, Sparkles } from "lucide-react";
import { format, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
  threads: MessageSquare,
  linkedin: Linkedin,
  pinterest: ImageIcon,
  spotify: Headphones,
};

export function ContentHQPlatformBoard({
  talents,
  selectedTalentId,
  platformFilter,
  onSelectPiece,
}: {
  talents: Talent[];
  selectedTalentId?: string;
  platformFilter?: string;
  onSelectPiece?: (piece: ContentPiece, talent: Talent) => void;
}) {
  const targets = selectedTalentId ? talents.filter(t => t.id === selectedTalentId) : talents;
  const queries = targets.map(t => useContentPieces(t.id));
  const allPieces = useMemo(
    () => queries.flatMap((q, i) => (q.data || []).map(p => ({ ...p, _talent: targets[i] }))),
    [queries, targets]
  );

  const today = startOfDay(new Date());
  const platforms = platformFilter ? PLATFORMS.filter(p => p.id === platformFilter) : PLATFORMS;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {platforms.map(pl => {
        const Icon = PLATFORM_ICONS[pl.id] || Sparkles;
        const items = allPieces
          .filter(p => p.platform === pl.id)
          .sort((a, b) => (a.scheduled_date || "").localeCompare(b.scheduled_date || ""));
        const upcoming = items.filter(p => p.scheduled_date && isAfter(new Date(p.scheduled_date + "T12:00:00"), today)).slice(0, 6);
        const published = items.filter(p => p.status === "published").length;
        const scheduled = items.filter(p => p.status === "scheduled").length;
        const inProd = items.filter(p => ["script", "shooting", "editing", "approval"].includes(p.status)).length;

        return (
          <Card key={pl.id} className="flex flex-col overflow-hidden border-l-4" style={{ borderLeftColor: `hsl(var(--primary))` }}>
            <div className={`px-4 py-3 flex items-center justify-between ${pl.color} border-b`}>
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5" />
                <h3 className="font-semibold">{pl.label}</h3>
              </div>
              <Badge variant="outline" className="bg-background/60">{items.length}</Badge>
            </div>

            <div className="grid grid-cols-3 gap-1 px-3 py-2 border-b text-center text-[11px]">
              <div><div className="font-bold text-cyan-700">{scheduled}</div><div className="text-muted-foreground">Agendados</div></div>
              <div><div className="font-bold text-purple-700">{inProd}</div><div className="text-muted-foreground">Produção</div></div>
              <div><div className="font-bold text-emerald-700">{published}</div><div className="text-muted-foreground">Publicados</div></div>
            </div>

            <div className="flex-1 p-3 space-y-2 min-h-[200px]">
              {upcoming.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  Nenhuma pauta agendada
                </div>
              ) : (
                upcoming.map(p => {
                  const st = PIECE_STATUSES.find(x => x.id === p.status);
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSelectPiece?.(p, p._talent)}
                      className="w-full text-left bg-muted/30 hover:bg-muted/60 transition-colors rounded p-2 border"
                    >
                      <div className="flex items-start gap-2">
                        <Avatar className="h-6 w-6 shrink-0">
                          {p._talent.avatar_url && <AvatarImage src={p._talent.avatar_url} />}
                          <AvatarFallback className="text-[10px]">{p._talent.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium line-clamp-2">{p.title}</div>
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                            {p.scheduled_date && (
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {format(new Date(p.scheduled_date + "T12:00:00"), "d MMM", { locale: ptBR })}
                              </span>
                            )}
                            <Badge variant="outline" className={`${st?.color} text-[9px] px-1 py-0`}>{st?.label}</Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
