import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface MonthPickerProps {
  /** Ano exibido no cabeçalho do painel (1-12 em `month`). */
  year: number;
  /** Mês selecionado, de 1 a 12. */
  month: number;
  onMonthChange: (month: number) => void;
  /** Opcional: usado pelo atalho "Este mês" para levar também ao ano atual. */
  onYearChange?: (year: number) => void;
}

export function MonthPicker({ year, month, onMonthChange, onYearChange }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const isCurrentPeriod = today.getFullYear() === year && month === currentMonth;

  const goToCurrentMonth = () => {
    onMonthChange(currentMonth);
    onYearChange?.(today.getFullYear());
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Escolher mês"
          className="min-w-[196px] justify-between gap-3 font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-medium">{MONTHS[month - 1]}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{year}</span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 opacity-60 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[300px] p-2.5">
        <div className="flex items-baseline justify-between px-1 pb-2">
          <p className="text-sm font-semibold">{MONTHS[month - 1]} de {year}</p>
          {isCurrentPeriod && (
            <span className="text-[11px] font-medium text-primary">mês atual</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Meses do ano">
          {MONTHS.map((name, index) => {
            const value = index + 1;
            const selected = value === month;
            const isThisMonth = today.getFullYear() === year && index === today.getMonth();
            return (
              <button
                key={name}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onMonthChange(value);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-10 items-center justify-center rounded-lg text-sm transition-all duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                  selected
                    ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                    : "hover:bg-secondary hover:text-foreground active:scale-[0.97]",
                  !selected && isThisMonth && "ring-1 ring-inset ring-primary/45",
                )}
              >
                {name}
              </button>
            );
          })}
        </div>

        <div className="mt-2 border-t pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goToCurrentMonth}
            className="w-full justify-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Este mês
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
