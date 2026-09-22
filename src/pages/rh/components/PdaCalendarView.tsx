import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, ChevronLeft, ChevronRight, Cake, Users, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { HRCollaborator } from "@/hooks/useHRCollaborators";
import { isPdaTerminated } from "@/lib/rh/pdaFilters";

type CalEvent = {
  id: string;
  day: number;
  kind: "birthday" | "meeting" | "checkin";
  label: string;
  route?: string;
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const KIND_STYLE: Record<CalEvent["kind"], string> = {
  birthday: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  meeting: "bg-primary/15 text-primary",
  checkin: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

const KIND_ICON = { birthday: Cake, meeting: Users, checkin: CheckCircle2 } as const;

export default function PdaCalendarView({ collaborators }: { collaborators: HRCollaborator[] }) {
  const navigate = useNavigate();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [remote, setRemote] = useState<CalEvent[]>([]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  useEffect(() => {
    let cancelled = false;
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 1).toISOString();
    const nameById = new Map(collaborators.map(c => [c.id, c]));

    const dayStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const dayEnd = new Date(year, month + 1, 1);
    const dayEndStr = `${dayEnd.getFullYear()}-${String(dayEnd.getMonth() + 1).padStart(2, "0")}-01`;

    (async () => {
      const [meetings, checkins, followups] = await Promise.all([
        supabase.from("hr_rh_meetings").select("id, title, scheduled_at").gte("scheduled_at", start).lt("scheduled_at", end),
        supabase.from("hr_pda_checkins").select("id, person_id, title, scheduled_at").gte("scheduled_at", start).lt("scheduled_at", end),
        supabase.from("hr_pda_followups").select("id, person_id, kind, followup_date").gte("followup_date", dayStart).lt("followup_date", dayEndStr),
      ]);
      if (cancelled) return;
      const evs: CalEvent[] = [];
      (meetings.data || []).forEach(m => {
        evs.push({ id: `m-${m.id}`, day: new Date(m.scheduled_at).getDate(), kind: "meeting", label: m.title || "Reunião RH-Diretoria" });
      });
      (checkins.data || []).forEach(k => {
        const person = nameById.get(k.person_id);
        evs.push({
          id: `k-${k.id}`,
          day: new Date(k.scheduled_at).getDate(),
          kind: "checkin",
          label: `Check-in · ${person?.full_name || k.title || "PDA"}`,
          route: person ? ((person as any).__route || `/rh/collaborators/${person.id}`) : undefined,
        });
      });
      (followups.data || []).forEach((f: any) => {
        const person = nameById.get(f.person_id);
        evs.push({
          id: `f-${f.id}`,
          day: new Date(`${f.followup_date}T12:00:00`).getDate(),
          kind: "checkin",
          label: `Acompanhamento ${f.kind || ""} · ${person?.full_name || "PDA"}`.replace("  ", " "),
          route: person ? ((person as any).__route || `/rh/collaborators/${person.id}`) : undefined,
        });
      });
      setRemote(evs);
    })();

    return () => { cancelled = true; };
  }, [year, month, collaborators]);

  const birthdays = useMemo<CalEvent[]>(() => {
    return collaborators
      .filter(c => c.hire_date && !isPdaTerminated(c))
      .flatMap(c => {
        const d = new Date(`${c.hire_date}T12:00:00`);
        if (d.getMonth() !== month) return [];
        const years = year - d.getFullYear();
        if (years < 1) return [];
        return [{
          id: `b-${c.id}`,
          day: d.getDate(),
          kind: "birthday" as const,
          label: `${c.full_name} · ${years} ano${years > 1 ? "s" : ""} de casa`,
          route: (c as any).__route || `/rh/collaborators/${c.id}`,
        }];
      });
  }, [collaborators, month, year]);

  const events = useMemo(() => [...birthdays, ...remote], [birthdays, remote]);
  const byDay = useMemo(() => {
    const map = new Map<number, CalEvent[]>();
    events.forEach(e => map.set(e.day, [...(map.get(e.day) || []), e]));
    return map;
  }, [events]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <div className="font-medium">{MONTHS[month]} {year}</div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>Hoje</Button>
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border bg-border">
          {WEEKDAYS.map(w => (
            <div key={w} className="bg-muted/50 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">{w}</div>
          ))}
          {cells.map((d, i) => (
            <div key={i} className="bg-background min-h-[104px] p-1.5 space-y-1">
              {d && (
                <>
                  <div className={`text-xs font-medium ${isToday(d) ? "text-primary" : "text-muted-foreground"}`}>{d}</div>
                  {(byDay.get(d) || []).map(e => {
                    const Icon = KIND_ICON[e.kind];
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => e.route && navigate(e.route)}
                        className={`w-full text-left rounded px-1.5 py-1 text-[11px] leading-tight flex items-start gap-1 ${KIND_STYLE[e.kind]} ${e.route ? "hover:opacity-80" : "cursor-default"}`}
                      >
                        <Icon className="h-3 w-3 mt-[1px] shrink-0" />
                        <span className="truncate">{e.label}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Cake className="h-3.5 w-3.5" /> Aniversário de empresa</span>
          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Reunião RH-Diretoria</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Check-in do PDA</span>
        </div>
      </CardContent>
    </Card>
  );
}
