import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Clock, Plus, Trash2 } from "lucide-react";

export type WorkScheduleRule = {
  days: string[];
  start_time: string;
  end_time: string;
  lunch_minutes: number;
};

export type WorkSchedule = {
  rules: WorkScheduleRule[];
};

// Legacy shape (single rule flattened) — kept for back-compat when reading old data.
type LegacyWorkSchedule = WorkScheduleRule;

const DAYS: { value: string; label: string; short: string }[] = [
  { value: "mon", label: "Segunda", short: "Seg" },
  { value: "tue", label: "Terça", short: "Ter" },
  { value: "wed", label: "Quarta", short: "Qua" },
  { value: "thu", label: "Quinta", short: "Qui" },
  { value: "fri", label: "Sexta", short: "Sex" },
  { value: "sat", label: "Sábado", short: "Sáb" },
  { value: "sun", label: "Domingo", short: "Dom" },
];

const emptyRule = (): WorkScheduleRule => ({
  days: [],
  start_time: "09:00",
  end_time: "18:00",
  lunch_minutes: 60,
});

/** Accepts old flat schedule, new {rules} schedule, null/undefined, or partial shapes. */
export function normalizeSchedule(input: any): WorkSchedule {
  if (!input) return { rules: [] };
  if (Array.isArray(input?.rules)) {
    return { rules: input.rules.filter(Boolean).map((r: any) => ({
      days: Array.isArray(r?.days) ? r.days : [],
      start_time: r?.start_time || "09:00",
      end_time: r?.end_time || "18:00",
      lunch_minutes: Number(r?.lunch_minutes) || 0,
    })) };
  }
  // legacy flat rule
  const legacy = input as LegacyWorkSchedule;
  if (Array.isArray(legacy?.days) && legacy.days.length) {
    return { rules: [{
      days: legacy.days,
      start_time: legacy.start_time || "09:00",
      end_time: legacy.end_time || "18:00",
      lunch_minutes: Number(legacy.lunch_minutes) || 0,
    }] };
  }
  return { rules: [] };
}

function ruleMinutes(r: WorkScheduleRule): number {
  if (!r?.start_time || !r?.end_time || !r?.days?.length) return 0;
  const [sh, sm] = r.start_time.split(":").map(Number);
  const [eh, em] = r.end_time.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const worked = eh * 60 + em - (sh * 60 + sm) - (Number(r.lunch_minutes) || 0);
  if (worked <= 0) return 0;
  return worked * r.days.length;
}

export function computeWeeklyHours(input: any): number {
  const s = normalizeSchedule(input);
  const total = s.rules.reduce((acc, r) => acc + ruleMinutes(r), 0);
  return +(total / 60).toFixed(4);
}

export function formatWeeklyHours(h: number): string {
  if (!h) return "0h";
  const totalMin = Math.round(h * 60);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins ? `${hours}h${String(mins).padStart(2, "0")}min` : `${hours}h`;
}

function validateRule(r: WorkScheduleRule, index: number): string | null {
  const prefix = `Regra ${index + 1}: `;
  if (!r?.days?.length) return `${prefix}selecione ao menos um dia.`;
  if (!r.start_time || !r.end_time) return `${prefix}informe entrada e saída.`;
  const [sh, sm] = r.start_time.split(":").map(Number);
  const [eh, em] = r.end_time.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return `${prefix}horários inválidos.`;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin) return `${prefix}a saída deve ser posterior à entrada.`;
  const lunch = Number(r.lunch_minutes) || 0;
  if (lunch < 0 || lunch > 240) return `${prefix}o almoço deve estar entre 0 e 240 minutos.`;
  if (lunch >= endMin - startMin) return `${prefix}o almoço não pode ser maior ou igual à jornada.`;
  return null;
}

export function validateSchedule(input: any): string | null {
  const s = normalizeSchedule(input);
  if (!s.rules.length) return "Adicione ao menos uma regra de horário.";
  const seen = new Set<string>();
  for (let i = 0; i < s.rules.length; i++) {
    const err = validateRule(s.rules[i], i);
    if (err) return err;
    for (const d of s.rules[i].days) {
      if (seen.has(d)) return `O dia ${DAYS.find((x) => x.value === d)?.short || d} está em mais de uma regra.`;
      seen.add(d);
    }
  }
  return null;
}

function summarizeRule(r: WorkScheduleRule): string {
  const dayLabels = DAYS.filter((d) => r.days.includes(d.value)).map((d) => d.short).join(", ");
  const lunch = r.lunch_minutes ? ` (${r.lunch_minutes}min de almoço)` : "";
  return `${dayLabels} • ${r.start_time}–${r.end_time}${lunch}`;
}

export function summarizeSchedule(input: any): string {
  const s = normalizeSchedule(input);
  if (!s.rules.length) return "";
  return s.rules.map(summarizeRule).join(" | ");
}

export function scheduleRuleSummaries(input: any): string[] {
  return normalizeSchedule(input).rules.filter((r) => r.days.length).map(summarizeRule);
}

const WEEK = ["mon", "tue", "wed", "thu", "fri"];
const WEEK_SAT = [...WEEK, "sat"];

export const SCHEDULE_PRESETS: { id: string; label: string; hint: string; schedule: WorkSchedule }[] = [
  { id: "clt-44", label: "44h — 5x2 + sábado", hint: "Seg–Sex 08:00–18:00 (1h almoço) + Sáb 08:00–12:00",
    schedule: { rules: [
      { days: WEEK, start_time: "08:00", end_time: "18:00", lunch_minutes: 60 },
      { days: ["sat"], start_time: "08:00", end_time: "12:00", lunch_minutes: 0 },
    ] } },
  { id: "comercial-40", label: "40h — 5x2 comercial", hint: "Seg–Sex 09:00–18:00 (1h almoço)",
    schedule: { rules: [{ days: WEEK, start_time: "09:00", end_time: "18:00", lunch_minutes: 60 }] } },
  { id: "comercial-44", label: "44h — 5x2 estendido", hint: "Seg–Sex 08:00–18:12 (1h almoço)",
    schedule: { rules: [{ days: WEEK, start_time: "08:00", end_time: "18:12", lunch_minutes: 60 }] } },
  { id: "36h-6x1", label: "36h — 6x1", hint: "Seg–Sáb 08:00–14:00 (sem almoço)",
    schedule: { rules: [{ days: WEEK_SAT, start_time: "08:00", end_time: "14:00", lunch_minutes: 0 }] } },
  { id: "meio-periodo", label: "30h — meio período", hint: "Seg–Sex 08:00–14:00 (sem almoço)",
    schedule: { rules: [{ days: WEEK, start_time: "08:00", end_time: "14:00", lunch_minutes: 0 }] } },
];

interface Props {
  value: WorkSchedule | any;
  onChange: (v: WorkSchedule) => void;
}

export default function WorkScheduleField({ value, onChange }: Props) {
  const schedule = normalizeSchedule(value);

  const updateRule = (idx: number, patch: Partial<WorkScheduleRule>) => {
    const rules = schedule.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange({ rules });
  };

  const toggleDay = (idx: number, d: string) => {
    const rule = schedule.rules[idx];
    const has = rule.days.includes(d);
    const nextDays = has ? rule.days.filter((x) => x !== d) : [...rule.days, d];
    const ordered = DAYS.map((x) => x.value).filter((x) => nextDays.includes(x));
    updateRule(idx, { days: ordered });
  };

  const addRule = () => onChange({ rules: [...schedule.rules, emptyRule()] });
  const removeRule = (idx: number) =>
    onChange({ rules: schedule.rules.filter((_, i) => i !== idx) });

  const weekly = computeWeeklyHours(schedule);
  const error = validateSchedule(schedule);

  // Preset active only when it matches ordered rules exactly.
  const activePreset = SCHEDULE_PRESETS.find((p) => {
    if (p.schedule.rules.length !== schedule.rules.length) return false;
    return p.schedule.rules.every((pr, i) => {
      const r = schedule.rules[i];
      return r && r.start_time === pr.start_time && r.end_time === pr.end_time &&
        r.lunch_minutes === pr.lunch_minutes &&
        r.days.length === pr.days.length && pr.days.every((d) => r.days.includes(d));
    });
  });

  // Days already used in previous rules — disable in later rules to avoid conflicts.
  const daysUsedBefore = (idx: number) =>
    new Set(schedule.rules.slice(0, idx).flatMap((r) => r.days));

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Horário de trabalho</Label>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Presets</Label>
        <div className="flex flex-wrap gap-2">
          {SCHEDULE_PRESETS.map((p) => {
            const on = activePreset?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                title={p.hint}
                onClick={() => onChange({ rules: p.schedule.rules.map((r) => ({ ...r, days: [...r.days] })) })}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {schedule.rules.length === 0 && (
        <div className="text-xs text-muted-foreground italic">
          Nenhuma regra configurada. Escolha um preset ou adicione uma regra manualmente.
        </div>
      )}

      {schedule.rules.map((rule, idx) => {
        const blocked = daysUsedBefore(idx);
        return (
          <div key={idx} className="rounded-md border bg-background p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Regra {idx + 1}
              </Label>
              {schedule.rules.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  onClick={() => removeRule(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                </Button>
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Dias da semana</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => {
                  const on = rule.days.includes(d.value);
                  const disabled = !on && blocked.has(d.value);
                  return (
                    <button
                      type="button"
                      key={d.value}
                      onClick={() => !disabled && toggleDay(idx, d.value)}
                      disabled={disabled}
                      title={disabled ? "Este dia já está em outra regra" : undefined}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : disabled
                          ? "bg-muted text-muted-foreground border-muted opacity-50 cursor-not-allowed"
                          : "bg-background hover:bg-accent"
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
                  value={rule.start_time}
                  onChange={(e) => updateRule(idx, { start_time: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Saída</Label>
                <Input
                  type="time"
                  value={rule.end_time}
                  onChange={(e) => updateRule(idx, { end_time: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Almoço (minutos)</Label>
                <Input
                  type="number"
                  min={0}
                  max={240}
                  step={15}
                  value={rule.lunch_minutes}
                  onChange={(e) => updateRule(idx, { lunch_minutes: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Subtotal desta regra: <span className="font-medium text-foreground">
                {formatWeeklyHours(ruleMinutes(rule) / 60)}
              </span>/semana
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={addRule}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar regra de horário
      </Button>

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between rounded-md bg-background border px-3 py-2">
        <span className="text-xs text-muted-foreground">Carga horária semanal total</span>
        <span className={`text-sm font-semibold ${error ? "text-muted-foreground" : ""}`}>
          {formatWeeklyHours(weekly)}
        </span>
      </div>
    </div>
  );
}

export { DAYS as WORK_SCHEDULE_DAYS };
