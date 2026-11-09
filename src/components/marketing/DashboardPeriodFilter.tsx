import { useState } from 'react';
import { endOfDay, endOfMonth, format, startOfDay, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export type PeriodPreset = 'all' | '7d' | '30d' | '90d' | 'month' | 'lastMonth' | '3m' | '6m' | '12m' | 'ytd' | 'custom';
export interface PeriodValue { preset: PeriodPreset; from?: Date; to?: Date }

const PRESETS: Array<{ key: Exclude<PeriodPreset, 'custom'>; label: string }> = [
  { key: 'all', label: 'Todo o período' },
  { key: '7d', label: 'Últimos 7 dias' },
  { key: '30d', label: 'Últimos 30 dias' },
  { key: '90d', label: 'Últimos 90 dias' },
  { key: 'month', label: 'Este mês' },
  { key: 'lastMonth', label: 'Mês passado' },
  { key: '3m', label: 'Últimos 3 meses' },
  { key: '6m', label: 'Últimos 6 meses' },
  { key: '12m', label: 'Últimos 12 meses' },
  { key: 'ytd', label: 'Este ano' },
];

/** Converte a escolha em datas de início/fim (início em 2000 para "Todo o período"). */
export function resolvePeriod(v: PeriodValue, now = new Date()): { startDate: Date; endDate: Date } {
  const end = endOfDay(now);
  switch (v.preset) {
    case 'all': return { startDate: new Date(2000, 0, 1), endDate: end };
    case '7d': return { startDate: startOfDay(subDays(now, 6)), endDate: end };
    case '30d': return { startDate: startOfDay(subDays(now, 29)), endDate: end };
    case '90d': return { startDate: startOfDay(subDays(now, 89)), endDate: end };
    case 'month': return { startDate: startOfMonth(now), endDate: end };
    case 'lastMonth': { const m = subMonths(now, 1); return { startDate: startOfMonth(m), endDate: endOfMonth(m) }; }
    case '3m': return { startDate: startOfMonth(subMonths(now, 2)), endDate: end };
    case '6m': return { startDate: startOfMonth(subMonths(now, 5)), endDate: end };
    case '12m': return { startDate: startOfMonth(subMonths(now, 11)), endDate: end };
    case 'ytd': return { startDate: startOfYear(now), endDate: end };
    case 'custom': {
      const from = v.from || startOfMonth(now);
      return { startDate: startOfDay(from), endDate: endOfDay(v.to || from) };
    }
  }
}

export function periodLabel(v: PeriodValue) {
  if (v.preset === 'custom' && v.from) {
    return v.to && v.to.getTime() !== v.from.getTime()
      ? `${format(v.from, 'dd/MM/yy')} – ${format(v.to, 'dd/MM/yy')}`
      : format(v.from, 'dd/MM/yyyy');
  }
  return PRESETS.find(p => p.key === v.preset)?.label || 'Personalizado';
}

export function DashboardPeriodFilter({ value, onChange, className }: { value: PeriodValue; onChange: (v: PeriodValue) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const isMobile = useIsMobile();
  const [draft, setDraft] = useState<DateRange | undefined>(value.preset === 'custom' ? { from: value.from, to: value.to } : undefined);

  const pick = (key: Exclude<PeriodPreset, 'custom'>) => { onChange({ preset: key }); setDraft(undefined); setOpen(false); };
  const onSelect = (r?: DateRange) => {
    setDraft(r);
    if (r?.from && r?.to) { onChange({ preset: 'custom', from: r.from, to: r.to }); setOpen(false); }
  };

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next);
      setShowCustom(false);
      if (next) setDraft(value.preset === 'custom' ? { from: value.from, to: value.to } : undefined);
    }}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('h-9 min-w-[200px] justify-between gap-2 bg-card font-normal', className)} aria-label="Escolher período">
          <span className="flex min-w-0 items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{periodLabel(value)}</span></span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-[calc(100vw-1.5rem)] p-0">
        <div className="flex flex-col sm:flex-row">
          <div className={cn('flex w-52 shrink-0 flex-col gap-1 p-2', showCustom && 'w-auto border-b sm:w-44 sm:border-b-0 sm:border-r')}>
            {PRESETS.map(p => (
              <Button key={p.key} type="button" variant="ghost" onClick={() => pick(p.key)}
                className={cn('h-8 shrink-0 justify-between gap-2 whitespace-nowrap rounded-md px-2.5 text-left text-sm font-normal',
                  !showCustom && value.preset === p.key && 'bg-primary/10 font-medium text-primary')}>
                {p.label}{value.preset === p.key && <Check className="h-3.5 w-3.5" />}
              </Button>
            ))}
            <Button type="button" variant="ghost" onClick={() => setShowCustom(true)}
              className={cn('mt-1 h-9 justify-between gap-2 border-t px-2.5 text-sm font-normal',
                (showCustom || value.preset === 'custom') && 'bg-primary/10 font-medium text-primary')}>
              Personalizado <CalendarDays className="h-3.5 w-3.5" />
            </Button>
          </div>
          {showCustom && <div>
            <div className="flex items-center justify-between border-b px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Personalizado</p>
              <p className="text-xs text-muted-foreground">
                {draft?.from ? `${format(draft.from, 'dd/MM/yy')} – ${draft.to ? format(draft.to, 'dd/MM/yy') : 'escolha o fim'}` : 'Escolha início e fim'}
              </p>
            </div>
            <Calendar
              mode="range"
              selected={draft}
              onSelect={onSelect}
              defaultMonth={draft?.from || subMonths(new Date(), isMobile ? 0 : 1)}
              numberOfMonths={isMobile ? 1 : 2}
              locale={ptBR}
              disabled={{ after: new Date() }}
              className="pointer-events-auto p-3"
            />
          </div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
