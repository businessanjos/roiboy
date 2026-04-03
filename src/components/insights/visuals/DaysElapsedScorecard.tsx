import { useMemo } from "react";
import { FONT_SCALE_MULTIPLIERS } from "../visual-builder/types";
import { Calendar, Briefcase, TrendingUp } from "lucide-react";

interface DaysElapsedScorecardProps {
  fontScale?: string;
}

// Brazilian national holidays (fixed dates)
const FIXED_HOLIDAYS: Array<[number, number]> = [
  [1, 1],   // Confraternização Universal
  [4, 21],  // Tiradentes
  [5, 1],   // Dia do Trabalho
  [9, 7],   // Independência
  [10, 12], // Nossa Senhora Aparecida
  [11, 2],  // Finados
  [11, 15], // Proclamação da República
  [11, 20], // Dia da Consciência Negra
  [12, 25], // Natal
];

// Easter-based movable holidays
function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getMovableHolidays(year: number): Date[] {
  const easter = computeEaster(year);
  const addDays = (d: Date, n: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  };
  return [
    addDays(easter, -47), // Carnaval (segunda)
    addDays(easter, -46), // Carnaval (terça)
    addDays(easter, -2),  // Sexta-feira Santa
    addDays(easter, 60),  // Corpus Christi
  ];
}

function getBrazilianHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  for (const [month, day] of FIXED_HOLIDAYS) {
    holidays.add(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  for (const d of getMovableHolidays(year)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    holidays.add(key);
  }
  return holidays;
}

function countBusinessDays(year: number, month: number, holidays: Set<string>, upToDay?: number): number {
  const totalDays = new Date(year, month + 1, 0).getDate();
  const limit = upToDay ? Math.min(upToDay, totalDays) : totalDays;
  let count = 0;
  for (let d = 1; d <= limit; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // weekend
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (holidays.has(key)) continue;
    count++;
  }
  return count;
}

export function DaysElapsedScorecard({ fontScale = "normal" }: DaysElapsedScorecardProps) {
  const m = FONT_SCALE_MULTIPLIERS[fontScale as keyof typeof FONT_SCALE_MULTIPLIERS] || 1;

  const stats = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentDay = now.getDate();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const monthName = now.toLocaleDateString("pt-BR", { month: "long" });
    const holidays = getBrazilianHolidays(year);
    const totalBusinessDays = countBusinessDays(year, month, holidays);
    const elapsedBusinessDays = countBusinessDays(year, month, holidays, currentDay);
    const percentElapsed = Math.round((currentDay / totalDays) * 100);

    return {
      currentDay,
      totalDays,
      totalBusinessDays,
      elapsedBusinessDays,
      percentElapsed,
      monthName,
    };
  }, []);

  const valueSize = Math.round(28 * m);
  const labelSize = Math.round(11 * m);
  const headerSize = Math.round(12 * m);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-3 py-2">
      {/* Month label */}
      <p className="text-muted-foreground font-medium capitalize" style={{ fontSize: `${headerSize}px` }}>
        {stats.monthName}
      </p>

      {/* Three metrics row */}
      <div className="flex items-stretch justify-center gap-4 w-full px-2">
        {/* Days elapsed */}
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <Calendar className="h-4 w-4 text-primary opacity-70" />
          <p className="font-bold text-foreground leading-none" style={{ fontSize: `${valueSize}px` }}>
            {stats.currentDay}
            <span className="font-normal text-muted-foreground" style={{ fontSize: `${Math.round(14 * m)}px` }}>
              /{stats.totalDays}
            </span>
          </p>
          <p className="text-muted-foreground text-center" style={{ fontSize: `${labelSize}px` }}>
            dias corridos
          </p>
        </div>

        {/* Separator */}
        <div className="w-px bg-border self-stretch" />

        {/* Business days */}
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <Briefcase className="h-4 w-4 text-primary opacity-70" />
          <p className="font-bold text-foreground leading-none" style={{ fontSize: `${valueSize}px` }}>
            {stats.elapsedBusinessDays}
            <span className="font-normal text-muted-foreground" style={{ fontSize: `${Math.round(14 * m)}px` }}>
              /{stats.totalBusinessDays}
            </span>
          </p>
          <p className="text-muted-foreground text-center" style={{ fontSize: `${labelSize}px` }}>
            dias úteis
          </p>
        </div>

        {/* Separator */}
        <div className="w-px bg-border self-stretch" />

        {/* Percentage */}
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          <TrendingUp className="h-4 w-4 text-primary opacity-70" />
          <p className="font-bold text-foreground leading-none" style={{ fontSize: `${valueSize}px` }}>
            {stats.percentElapsed}%
          </p>
          <p className="text-muted-foreground text-center" style={{ fontSize: `${labelSize}px` }}>
            do mês
          </p>
        </div>
      </div>
    </div>
  );
}
