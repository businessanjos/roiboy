import { useState } from 'react';
import { format, startOfMonth, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface SocialPostsDateFilterProps {
  dateFrom?: Date;
  dateTo?: Date;
  onFromChange: (date?: Date) => void;
  onToChange: (date?: Date) => void;
}

export function SocialPostsDateFilter({ dateFrom, dateTo, onFromChange, onToChange }: SocialPostsDateFilterProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const selected: DateRange | undefined = dateFrom || dateTo ? { from: dateFrom, to: dateTo } : undefined;
  const label = dateFrom && dateTo
    ? `${format(dateFrom, 'dd/MM/yy')} – ${format(dateTo, 'dd/MM/yy')}`
    : dateFrom
      ? `A partir de ${format(dateFrom, 'dd/MM/yy')}`
      : dateTo
        ? `Até ${format(dateTo, 'dd/MM/yy')}`
        : 'Todo o período';

  const selectRange = (range?: DateRange) => {
    onFromChange(range?.from);
    onToChange(range?.to);
    if (range?.from && range?.to) setOpen(false);
  };

  const selectPreset = (days?: number | 'month') => {
    if (!days) {
      onFromChange(undefined);
      onToChange(undefined);
    } else {
      onFromChange(days === 'month' ? startOfMonth(new Date()) : subDays(new Date(), days - 1));
      onToChange(new Date());
    }
    setOpen(false);
  };

  const presets = [
    { label: 'Todo o período', value: undefined, active: !dateFrom && !dateTo },
    { label: 'Últimos 7 dias', value: 7 as const, active: false },
    { label: 'Últimos 30 dias', value: 30 as const, active: false },
    { label: 'Este mês', value: 'month' as const, active: false },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 min-w-[210px] justify-between gap-2 font-normal" aria-label="Filtrar por período">
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-1.5rem)] overflow-x-auto p-0">
        <div className="flex flex-wrap gap-1.5 border-b bg-muted/20 p-3">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant={preset.active ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('h-7 px-2.5 text-xs', preset.active && 'font-medium')}
              onClick={() => selectPreset(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={dateFrom || dateTo || new Date()}
          selected={selected}
          onSelect={selectRange}
          numberOfMonths={isMobile ? 1 : 2}
          locale={ptBR}
          captionLayout="dropdown"
          fromYear={2020}
          toYear={new Date().getFullYear() + 1}
          className="pointer-events-auto"
        />
        <p className="border-t px-4 py-2.5 text-center text-xs text-muted-foreground">
          Selecione o primeiro e o último dia do período.
        </p>
      </PopoverContent>
    </Popover>
  );
}
