import { Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_WEEKDAYS, recurrenceDate, recurrenceDateText, type TaskRecurrence } from "@/lib/marketing/taskRecurrence";

interface Props {
  value: TaskRecurrence | null;
  onChange: (rule: TaskRecurrence | null) => void;
  date?: Date;
  disabled?: boolean;
  sourceId?: string | null;
  onEditSource?: () => void;
  nextDate?: string | null;
}

export function TaskRecurrenceEditor({ value, onChange, date, disabled, sourceId, onEditSource, nextDate }: Props) {
  return <div className="space-y-3 border-t pt-4">
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Repeat2 className="h-4 w-4" />Repetição</h3>
    {sourceId ? <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Ocorrência de uma tarefa recorrente.</p>
      {onEditSource && <Button type="button" variant="outline" size="sm" className="w-full" onClick={onEditSource} disabled={disabled}><Repeat2 className="h-3.5 w-3.5" />Editar repetições futuras</Button>}
    </div> : <>
      <div className="space-y-1.5"><Label htmlFor="task-repeat" className="text-xs text-muted-foreground">Repetir</Label>
        <Select value={value?.frequency ?? "none"} disabled={disabled} onValueChange={(frequency) => onChange(frequency === "daily" ? { frequency } : frequency === "weekly" ? { frequency, weekday: date?.getDay() ?? 1 } : frequency === "monthly" ? { frequency, month_day: date?.getDate() ?? new Date().getDate() } : null)}>
          <SelectTrigger id="task-repeat"><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="none">Não repetir</SelectItem><SelectItem value="daily">Diariamente</SelectItem><SelectItem value="weekly">Semanalmente</SelectItem><SelectItem value="monthly">Mensalmente</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value?.frequency === "weekly" && <div className="space-y-1.5"><Label htmlFor="task-repeat-weekday" className="text-xs text-muted-foreground">Dia da semana</Label>
        <Select value={String(value.weekday ?? 1)} disabled={disabled} onValueChange={(day) => onChange({ frequency: "weekly", weekday: Number(day) })}>
          <SelectTrigger id="task-repeat-weekday"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 6, 0].map((day) => <SelectItem key={day} value={String(day)}>{TASK_WEEKDAYS[day]}</SelectItem>)}</SelectContent>
        </Select>
      </div>}
      {value?.frequency === "monthly" && <div className="space-y-1.5"><Label htmlFor="task-repeat-monthday" className="text-xs text-muted-foreground">Dia do mês</Label>
        <Select value={String(value.month_day ?? 1)} disabled={disabled} onValueChange={(day) => onChange({ frequency: "monthly", month_day: Number(day) })}>
          <SelectTrigger id="task-repeat-monthday"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 31 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}</SelectContent>
        </Select>
        {(value.month_day ?? 1) > 28 && <p className="text-xs text-muted-foreground">Nos meses mais curtos, no último dia do mês.</p>}
      </div>}
      {value && <div className="space-y-1 text-xs text-muted-foreground">
        <p>Próxima entrega: <span className="font-medium text-foreground">{nextDate ? nextDate.split("-").reverse().join("/") : date ? recurrenceDateText(recurrenceDate(value, date > new Date() ? date : new Date(), false)) : "—"}</span></p>
        <p>Novas tarefas serão abertas automaticamente. As concluídas permanecem no histórico.</p>
      </div>}
    </>}
  </div>;
}