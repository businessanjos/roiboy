import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock } from "lucide-react";
import { buildEventVariables, type PlaybookEventVars } from "@/lib/playbookEventVars";

interface Props {
  value: PlaybookEventVars;
  onChange: (v: PlaybookEventVars) => void;
}

/** Dados do encontro: a consultora troca só aqui e o texto se atualiza sozinho. */
export function PlaybookEventFields({ value, onChange }: Props) {
  const vars = buildEventVariables(value);
  const set = (patch: Partial<PlaybookEventVars>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarClock className="h-4 w-4 text-primary" /> Dados do encontro
      </div>
      <p className="text-xs text-muted-foreground">
        Troque a data e o horário aqui. A contagem regressiva, o dia da semana e o mês são calculados sozinhos no dia do envio.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Data</Label>
          <Input type="date" value={value.date || ""} onChange={(e) => set({ date: e.target.value || null })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Início</Label>
          <Input type="time" value={value.start || ""} onChange={(e) => set({ start: e.target.value || null })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fim</Label>
          <Input type="time" value={value.end || ""} onChange={(e) => set({ end: e.target.value || null })} />
        </div>
      </div>
      {value.date && (
        <p className="text-xs text-muted-foreground">
          Hoje sairia: <span className="text-foreground">{vars.contagem_regressiva}</span> · {vars.data_evento} ({vars.dia_semana_evento})
          {vars.horario_evento ? ` · ${vars.horario_evento}` : ""} · {vars.mes_evento}
        </p>
      )}
    </div>
  );
}
