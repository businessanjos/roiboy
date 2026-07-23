import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock } from "lucide-react";

export type WorkSchedule = {
  days: string[];
  start_time: string;
  end_time: string;
  lunch_minutes: number;
};

const DAYS: { value: string; label: string; short: string }[] = [
  { value: "mon", label: "Segunda", short: "Seg" },
  { value: "tue", label: "Terça", short: "Ter" },
  { value: "wed", label: "Quarta", short: "Qua" },
  { value: "thu", label: "Quinta", short: "Qui" },
  { value: "fri", label: "Sexta", short: "Sex" },
  { value: "sat", label: "Sábado", short: "Sáb" },
  { value: "sun", label: "Domingo", short: "Dom" },
];

export function computeWeeklyHours(s: WorkSchedule): number {
  if (!s?.start_time || !s?.end_time || !s?.days?.length) return 0;
  const [sh, sm] = s.start_time.split(":").map(Number);
  const [eh, em] = s.end_time.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const workedMin = endMin - startMin - (Number(s.lunch_minutes) || 0);
  if (workedMin <= 0) return 0;
  return +(workedMin * s.days.length / 60).toFixed(2);
}

export function formatWeeklyHours(h: number): string {
  if (!h) return "0h";
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return mins ? `${hours}h${String(mins).padStart(2, "0")}` : `${hours}h`;
}

export function summarizeSchedule(s: WorkSchedule | null | undefined): string {
  if (!s || !s.days?.length) return "";
  const dayLabels = DAYS.filter((d) => s.days.includes(d.value)).map((d) => d.short).join(", ");
  const lunch = s.lunch_minutes ? ` (${s.lunch_minutes}min de almoço)` : "";
  return `${dayLabels} • ${s.start_time}–${s.end_time}${lunch}`;
}

interface Props {
  value: WorkSchedule;
  onChange: (v: WorkSchedule) => void;
}

export default function WorkScheduleField({ value, onChange }: Props) {
  const toggleDay = (d: string) => {
    const next = value.days.includes(d) ? value.days.filter((x) => x !== d) : [...value.days, d];
    // preserve week order
    const ordered = DAYS.map((x) => x.value).filter((x) => next.includes(x));
    onChange({ ...value, days: ordered });
  };
  const weekly = computeWeeklyHours(value);
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Horário de trabalho</Label>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Dias da semana</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d) => {
            const on = value.days.includes(d.value);
            return (
              <button
                type="button"
                key={d.value}
                onClick={() => toggleDay(d.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                }`}
              >
                {d.short}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Entrada</Label>
          <Input
            type="time"
            value={value.start_time}
            onChange={(e) => onChange({ ...value, start_time: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Saída</Label>
          <Input
            type="time"
            value={value.end_time}
            onChange={(e) => onChange({ ...value, end_time: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Almoço (minutos)</Label>
          <Input
            type="number"
            min={0}
            max={240}
            step={15}
            value={value.lunch_minutes}
            onChange={(e) => onChange({ ...value, lunch_minutes: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-md bg-background border px-3 py-2">
        <span className="text-xs text-muted-foreground">Carga horária semanal</span>
        <span className="text-sm font-semibold">{formatWeeklyHours(weekly)}</span>
      </div>
    </div>
  );
}

export { DAYS as WORK_SCHEDULE_DAYS };
