import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface MarketingDateFilterProps {
  year: number;
  selectedMonth: number | null; // null = full year
  onMonthChange: (month: number | null) => void;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function MarketingDateFilter({ year, selectedMonth, onMonthChange }: MarketingDateFilterProps) {
  const label = selectedMonth !== null
    ? `${MONTHS[selectedMonth]} ${year}`
    : `Ano completo ${year}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarDays className="h-4 w-4" />
          {label}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-auto">
        <DropdownMenuItem
          onClick={() => onMonthChange(null)}
          className={cn(selectedMonth === null && "bg-accent")}
        >
          Ano completo {year}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {MONTHS.map((name, idx) => (
          <DropdownMenuItem
            key={idx}
            onClick={() => onMonthChange(idx)}
            className={cn(selectedMonth === idx && "bg-accent")}
          >
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
