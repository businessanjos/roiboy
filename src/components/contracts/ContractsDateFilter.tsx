import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export type ContractsDatePreset = "today" | "month" | "quarter" | "year" | "custom";

export interface ContractsDateFilterValue {
  preset: ContractsDatePreset;
  start: string; // ISO
  end: string; // ISO
}

export function getPresetRange(preset: Exclude<ContractsDatePreset, "custom">): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "quarter":
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "year":
      return { start: startOfYear(now), end: endOfYear(now) };
  }
}

export function getDefaultContractsDateFilter(): ContractsDateFilterValue {
  const { start, end } = getPresetRange("year");
  return { preset: "year", start: start.toISOString(), end: end.toISOString() };
}

const PRESETS: { value: Exclude<ContractsDatePreset, "custom">; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "month", label: "Este Mês" },
  { value: "quarter", label: "Este Trimestre" },
  { value: "year", label: "Este Ano" },
];

const PRESET_LABEL: Record<ContractsDatePreset, string> = {
  today: "Hoje",
  month: "Este Mês",
  quarter: "Este Trimestre",
  year: "Este Ano",
  custom: "Personalizado",
};

interface Props {
  value: ContractsDateFilterValue;
  onChange: (value: ContractsDateFilterValue) => void;
}

export function ContractsDateFilter({ value, onChange }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [range, setRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(value.start),
    to: new Date(value.end),
  });

  const label =
    value.preset === "custom"
      ? `${format(new Date(value.start), "dd/MM/yy", { locale: ptBR })} - ${format(new Date(value.end), "dd/MM/yy", { locale: ptBR })}`
      : PRESET_LABEL[value.preset];

  const handlePreset = (p: Exclude<ContractsDatePreset, "custom">) => {
    const { start, end } = getPresetRange(p);
    onChange({ preset: p, start: start.toISOString(), end: end.toISOString() });
  };

  const handleCustomSelect = (r: { from?: Date; to?: Date } | undefined) => {
    if (!r) return;
    setRange({ from: r.from, to: r.to });
    if (r.from && r.to) {
      onChange({
        preset: "custom",
        start: startOfDay(r.from).toISOString(),
        end: endOfDay(r.to).toISOString(),
      });
      setCustomOpen(false);
    }
  };

  if (customOpen) {
    return (
      <Popover open={customOpen} onOpenChange={setCustomOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2 w-full md:w-auto">
            <CalendarDays className="h-4 w-4" />
            {label}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={range.from}
            selected={range}
            onSelect={handleCustomSelect}
            numberOfMonths={2}
            locale={ptBR}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 w-full md:w-auto">
          <CalendarDays className="h-4 w-4" />
          {label}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {PRESETS.map((p) => (
          <DropdownMenuItem
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={cn(value.preset === p.value && "bg-accent")}
          >
            {p.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            setDropdownOpen(false);
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
