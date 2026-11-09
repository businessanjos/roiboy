import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { parseTypedFilterDate } from './typedFilterDate';

export function TypedDateFilter({ label, value, onChange }: {
  label: string;
  value?: Date;
  onChange: (value?: Date) => void;
}) {
  const [text, setText] = useState(value ? format(value, 'dd/MM/yyyy') : '');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    setText(value ? format(value, 'dd/MM/yyyy') : '');
    setError(false);
  }, [value]);

  function commit() {
    if (!text.trim()) { onChange(undefined); setError(false); return; }
    const date = parseTypedFilterDate(text);
    setError(!date);
    if (date) onChange(date);
  }

  return (
    <div className="relative w-[164px]">
      <div className="relative">
        <Input
          type="text" inputMode="numeric" aria-label={`Data ${label.toLowerCase()}`}
          placeholder={`${label} · dd/mm/aaaa`} value={text} maxLength={10}
          aria-invalid={error}
          className="h-9 bg-card pr-9 text-xs tabular-nums aria-[invalid=true]:border-destructive"
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
            const next = digits.length > 4 ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}` : digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
            setText(next); setError(false);
            if (!next) onChange(undefined);
            const date = parseTypedFilterDate(next);
            if (date) onChange(date);
          }}
          onBlur={commit}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-9 text-primary" aria-label={`Abrir calendário ${label.toLowerCase()}`} title={`Calendário ${label.toLowerCase()}`}>
              <CalendarDays className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={value} defaultMonth={value} locale={ptBR} initialFocus className="pointer-events-auto"
              onSelect={(date) => { onChange(date); setOpen(false); }} />
            <div className="flex justify-between border-t px-3 py-2">
              <Button variant="ghost" size="sm" onClick={() => { onChange(undefined); setText(''); setError(false); setOpen(false); }}>Limpar</Button>
              <Button variant="ghost" size="sm" onClick={() => { onChange(new Date()); setOpen(false); }}>Hoje</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-destructive">Data inválida: dd/mm/aaaa</p>}
    </div>
  );
}