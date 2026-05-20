import { useMemo, useState } from "react";
import { Talent, useContentPieces, PLATFORMS, PIECE_STATUSES } from "@/hooks/useContentHQ";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ContentHQCalendar({ talents, selectedTalentId }: { talents: Talent[]; selectedTalentId?: string }) {
  const [month, setMonth] = useState(new Date());
  // Fetch for the selected talent or all
  const targets = selectedTalentId ? talents.filter(t => t.id === selectedTalentId) : talents;
  const queries = targets.map(t => useContentPieces(t.id));
  const allPieces = queries.flatMap((q, i) => (q.data || []).map(p => ({ ...p, talentName: targets[i].name })));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{format(month, "MMMM 'de' yyyy", { locale: ptBR })}</h2>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded overflow-hidden">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d => <div key={d} className="bg-muted px-2 py-1.5 text-xs font-semibold text-center">{d}</div>)}
        {days.map((d) => {
          const inMonth = d.getMonth() === month.getMonth();
          const pieces = allPieces.filter(p => p.scheduled_date && isSameDay(new Date(p.scheduled_date + "T12:00:00"), d));
          return (
            <div key={d.toISOString()} className={`bg-background min-h-[100px] p-1.5 ${inMonth ? "" : "opacity-40"}`}>
              <div className="text-xs text-muted-foreground mb-1">{format(d, "d")}</div>
              <div className="space-y-1">
                {pieces.slice(0, 4).map(p => {
                  const pl = PLATFORMS.find(x => x.id === p.platform);
                  const st = PIECE_STATUSES.find(x => x.id === p.status);
                  return (
                    <div key={p.id} className={`text-[10px] px-1.5 py-0.5 rounded border ${pl?.color || "bg-muted"}`} title={`${p.talentName}: ${p.title} (${st?.label})`}>
                      <span className="font-semibold">{p.talentName[0]}</span> {p.title.slice(0, 18)}
                    </div>
                  );
                })}
                {pieces.length > 4 && <div className="text-[10px] text-muted-foreground">+{pieces.length - 4}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 flex-wrap mt-3">
        {PLATFORMS.map(p => <Badge key={p.id} variant="outline" className={p.color}>{p.label}</Badge>)}
      </div>
    </Card>
  );
}
