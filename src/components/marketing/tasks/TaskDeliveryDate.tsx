import { useEffect, useState } from "react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { deliveryDateInput, parseDeliveryDate } from "@/lib/marketing/taskDescription";

export function TaskDeliveryDate({ value, onChange, onValidityChange, disabled, portalContainer }: {
  value?: Date; onChange: (date?: Date) => void; onValidityChange: (valid: boolean) => void;
  disabled?: boolean; portalContainer: HTMLElement | null;
}) {
  const [text, setText] = useState(value ? format(value, "dd/MM/yyyy") : "");
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const formatted = value ? format(value, "dd/MM/yyyy") : "";
  useEffect(() => { setText(formatted); }, [formatted]);
  const valid = !text || !!parseDeliveryDate(text);
  const choose = (date?: Date) => { setText(date ? format(date, "dd/MM/yyyy") : ""); onChange(date); onValidityChange(true); setTouched(false); setOpen(false); };
  return <div>
    <div className="relative flex items-center">
      <Input id="task-delivery-date" aria-describedby={!valid && touched ? "task-date-error" : undefined} aria-invalid={!valid && touched} inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10} className="h-9 pr-20" value={text} disabled={disabled}
        onBlur={() => setTouched(true)} onChange={(event) => {
          const next = deliveryDateInput(event.target.value); setText(next);
          const date = parseDeliveryDate(next); onValidityChange(!next || !!date);
          if (date || !next) onChange(date);
        }} />
      <div className="absolute right-1 flex">
        {text && <Button type="button" variant="ghost" size="icon" aria-label="Limpar data de entrega" title="Limpar data" className="h-7 w-8" disabled={disabled} onClick={() => choose(undefined)}><X className="h-3.5 w-3.5" /></Button>}
        <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label="Abrir calendário de entrega" title="Calendário" className="h-7 w-8 text-primary" disabled={disabled}><CalendarDays className="h-4 w-4" /></Button></PopoverTrigger>
          <PopoverContent portalContainer={portalContainer} collisionBoundary={portalContainer ?? undefined} collisionPadding={12}
            className="max-h-[var(--radix-popover-content-available-height)] w-auto max-w-[var(--radix-popover-content-available-width)] overflow-y-auto p-0" align="end">
            <Calendar mode="single" selected={value} defaultMonth={value} onSelect={choose} locale={ptBR} initialFocus className="pointer-events-auto" />
            <div className="flex items-center justify-between border-t bg-muted/40 px-3 py-1.5"><Button type="button" variant="ghost" size="sm" onClick={() => choose(undefined)}>Limpar</Button><Button type="button" variant="ghost" size="sm" className="text-primary" onClick={() => choose(new Date())}>Hoje</Button></div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Atalhos da data de entrega">
      {[{ label: "Hoje", offset: 0 }, { label: "Amanhã", offset: 1 }].map(({ label, offset }) => {
        const selected = !!value && text === formatted && isSameDay(value, addDays(new Date(), offset));
        return <Button key={label} type="button" variant="ghost" size="sm" aria-label={`Entregar ${label.toLocaleLowerCase("pt-BR")}`} aria-pressed={selected} disabled={disabled}
          className={`h-6 rounded-full border px-2.5 text-xs font-normal ${selected ? "border-primary/20 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary" : "border-border/70 text-muted-foreground hover:border-primary/30 hover:bg-muted/50 hover:text-foreground"}`}
          onClick={() => choose(startOfDay(addDays(new Date(), offset)))}>{label}</Button>;
      })}
    </div>
    {touched && !valid && <p id="task-date-error" role="alert" className="mt-1 text-xs text-destructive">Data inválida.</p>}
  </div>;
}