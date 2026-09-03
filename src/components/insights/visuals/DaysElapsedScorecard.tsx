import { useMemo } from "react";
import { FONT_SCALE_MULTIPLIERS } from "../visual-builder/types";
import { Calendar, Briefcase, TrendingUp } from "lucide-react";
import { useChartSize } from "./useChartSize";

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

  // Ajuste ao espaço real do card: evita que o mês/rótulos sejam cortados e
  // mantém as três métricas centralizadas vertical e horizontalmente.
  const { ref, height } = useChartSize();
  const h = height || 120;
  const fit = Math.max(0.7, Math.min(1.25, h / 130));
  const valueSize = Math.round(28 * m * fit);
  const labelSize = Math.round(11 * m * fit);
  const headerSize = Math.round(12 * m * fit);
  const subSize = Math.round(14 * m * fit);
  const iconSize = Math.round(16 * m * fit);
  const showMonth = h >= 110;

  const items = [
    {
      Icon: Calendar,
      value: String(stats.currentDay),
      suffix: `/${stats.totalDays}`,
      label: "dias corridos",
    },
    {
      Icon: Briefcase,
      value: String(stats.elapsedBusinessDays),
      suffix: `/${stats.totalBusinessDays}`,
      label: "dias úteis",
    },
    {
      Icon: TrendingUp,
      value: `${stats.percentElapsed}%`,
      suffix: "",
      label: "do mês",
    },
  ];

  return (
    <div ref={ref} className="flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden">
      {showMonth && (
        <p
          className="text-muted-foreground font-medium capitalize leading-none"
          style={{ fontSize: `${headerSize}px` }}
        >
          {stats.monthName}
        </p>
      )}

      <div className="grid w-full grid-cols-3 items-center divide-x divide-border">
        {items.map(({ Icon, value, suffix, label }) => (
          <div key={label} className="flex min-w-0 flex-col items-center justify-center gap-1 px-2">
            <Icon
              className="text-primary opacity-70"
              style={{ width: iconSize, height: iconSize }}
            />
            <p className="font-bold text-foreground leading-none" style={{ fontSize: `${valueSize}px` }}>
              {value}
              {suffix && (
                <span className="font-normal text-muted-foreground" style={{ fontSize: `${subSize}px` }}>
                  {suffix}
                </span>
              )}
            </p>
            <p
              className="text-muted-foreground text-center leading-tight"
              style={{ fontSize: `${labelSize}px` }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
