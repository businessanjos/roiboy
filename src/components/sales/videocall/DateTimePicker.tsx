import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  /** Valor no formato "yyyy-MM-ddTHH:mm" (mesmo do input datetime-local). */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function parse(value: string): { date: Date | undefined; time: string } {
  if (!value) return { date: undefined, time: "" };
  const [d, t = ""] = value.split("T");
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return { date: undefined, time: t };
  return { date: new Date(y, m - 1, day), time: t };
}

function build(date: Date | undefined, time: string): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${d}T${time || "09:00"}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export function DateTimePicker({ value, onChange, className }: DateTimePickerProps) {
  const { date, time } = parse(value);
  const [hour = "09", minute = "00"] = (time || "09:00").split(":");


  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "flex-1 justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {date
              ? format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
              : "Escolher a data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={date}
            defaultMonth={date}
            onSelect={(d) => onChange(build(d ?? undefined, time))}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
          <div className="flex items-center justify-between border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => onChange("")}
            >
              Limpar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => onChange(build(new Date(), time))}
            >
              Hoje
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal sm:w-[140px]",
              !time && "text-muted-foreground"
            )}
          >
            <Clock className="mr-2 h-4 w-4 shrink-0" />
            {time || "Horário"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex divide-x">
            <ScrollArea className="h-56 w-20">
              <div className="p-1">
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onChange(build(date ?? new Date(), `${h}:${minute}`))}
                    className={cn(
                      "w-full rounded-md px-2 py-1.5 text-center text-sm hover:bg-accent",
                      hour === h && "bg-primary text-primary-foreground hover:bg-primary"
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </ScrollArea>
            <ScrollArea className="h-56 w-20">
              <div className="p-1">
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onChange(build(date ?? new Date(), `${hour}:${m}`))}
                    className={cn(
                      "w-full rounded-md px-2 py-1.5 text-center text-sm hover:bg-accent",
                      minute === m && "bg-primary text-primary-foreground hover:bg-primary"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                const now = new Date();
                const pad = (n: number) => String(n).padStart(2, "0");
                onChange(build(date ?? now, `${pad(now.getHours())}:${pad(now.getMinutes())}`));
              }}
            >
              Agora
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

