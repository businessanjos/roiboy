import { useState } from "react";
import { endOfDay, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type CxPeriodPreset = "today" | "7" | "30" | "90" | "all" | "custom";

export interface CxPeriodValue {
  preset: CxPeriodPreset;
  /** ISO strings, only for preset "custom". */
  start?: string;
  end?: string;
}

export const CX_PRESET_LABEL: Record<CxPeriodPreset, string> = {
  today: "Hoje",
  "7": "Próximos 7 dias",
  "30": "Próximos 30 dias",
  "90": "Próximos 90 dias",
  all: "Todos",
  custom: "Personalizado",
};

export function periodTriggerLabel(v: CxPeriodValue): string {
  if (v.preset === "custom" && v.start && v.end) {
    return `${format(new Date(v.start), "dd/MM/yy", { locale: ptBR })} – ${format(new Date(v.end), "dd/MM/yy", { locale: ptBR })}`;
  }
  return CX_PRESET_LABEL[v.preset];
}

interface CxPeriodFilterProps {
  value: CxPeriodValue;
  onChange: (v: CxPeriodValue) => void;
  /** Which presets appear in the menu. */
  presets?: CxPeriodPreset[];
  className?: string;
  ariaLabel?: string;
}

/** Period filter with quick presets plus a custom date-range calendar. */
export function CxPeriodFilter({
  value,
  onChange,
  presets = ["today", "7", "30", "90", "all", "custom"],
  className,
  ariaLabel,
}: CxPeriodFilterProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const isMobile = useIsMobile();
  const [range, setRange] = useState<DateRange | undefined>(() =>
    value.preset === "custom" && value.start && value.end
      ? { from: new Date(value.start), to: new Date(value.end) }
      : undefined,
  );

  const label = periodTriggerLabel(value);

  const handleCustomSelect = (r: DateRange | undefined) => {
    if (!r) return;
    setRange(r);
    if (r.from && r.to) {
      onChange({
        preset: "custom",
        start: startOfDay(r.from).toISOString(),
        end: endOfDay(r.to).toISOString(),
      });
      setCustomOpen(false);
    }
  };

  const triggerButton = (
    <Button
      variant="outline"
      aria-label={ariaLabel}
      className={cn("h-11 gap-2 justify-between font-normal w-full sm:w-52", className)}
    >
      <span className="flex items-center gap-2 min-w-0">
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </span>
      <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
    </Button>
  );

  if (customOpen) {
    return (
      <Popover open onOpenChange={(o) => !o && setCustomOpen(false)}>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={range?.from || new Date()}
            selected={range?.from ? range : undefined}
            onSelect={handleCustomSelect}
            numberOfMonths={isMobile ? 1 : 2}
            locale={ptBR}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {presets.filter((p) => p !== "custom").map((p) => (
          <DropdownMenuItem
            key={p}
            onClick={() => {
              setMenuOpen(false);
              onChange({ preset: p });
            }}
            className={cn(value.preset === p && "bg-accent")}
          >
            {CX_PRESET_LABEL[p]}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setMenuOpen(false);
            setTimeout(() => setCustomOpen(true), 100);
          }}
          className={cn(value.preset === "custom" && "bg-accent")}
        >
          Personalizado...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Upper (and, for custom ranges, lower) bound in ms used to filter by send date. */
export function cxPeriodBounds(p: CxPeriodValue): { min: number; max: number } {
  if (p.preset === "all") return { min: -Infinity, max: Infinity };
  if (p.preset === "today") return { min: -Infinity, max: endOfDay(new Date()).getTime() };
  if (p.preset === "custom") {
    return {
      min: p.start ? new Date(p.start).getTime() : -Infinity,
      max: p.end ? new Date(p.end).getTime() : Infinity,
    };
  }
  return { min: -Infinity, max: Date.now() + Number(p.preset) * 86400000 };
}
