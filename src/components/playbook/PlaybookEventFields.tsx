import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarClock, Link2, Calendar, Clock, Hourglass, Eye } from "lucide-react";
import { buildEventVariables, usesEventVariables, type PlaybookEventVars } from "@/lib/playbookEventVars";

interface Props {
  value: PlaybookEventVars;
  onChange: (v: PlaybookEventVars) => void;
  /** Texto da mensagem para mostrar a prévia já preenchida. */
  previewText?: string | null;
  /** Texto bruto para saber quais campos mostrar. */
  rawText?: string | null;
  /** Insere a variável no texto (botões de 1 clique). */
  onInsert?: (variable: string) => void;
  /** Esconde a prévia (quando ela é mostrada em outro lugar). */
  hidePreview?: boolean;
}

const QUICK = [
  { key: "link_evento", label: "Link", icon: Link2 },
  { key: "data_evento", label: "Data", icon: Calendar },
  { key: "dia_semana_evento", label: "Dia da semana", icon: Calendar },
  { key: "horario_evento", label: "Horário", icon: Clock },
  { key: "contagem_regressiva", label: "Contagem", icon: Hourglass },
  { key: "mes_evento", label: "Mês", icon: Calendar },
];

/** Campos variáveis da mensagem: a consultora troca só aqui e o texto se atualiza sozinho. */
export function PlaybookEventFields({ value, onChange, previewText, rawText, onInsert, hidePreview }: Props) {
  const vars = buildEventVariables(value);
  const set = (patch: Partial<PlaybookEventVars>) => onChange({ ...value, ...patch });
  const txt = rawText ?? "";
  const hasLink = txt.includes("{{link_evento}}") || !!value.link;
  const hasDate = /\{\{(contagem_regressiva|data_evento|dia_semana_evento|horario_evento|mes_evento)\}\}/.test(txt) || !!value.date;
  const showFields = rawText == null ? true : hasLink || hasDate;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarClock className="h-4 w-4 text-primary" /> Campos que mudam
      </div>
      {onInsert && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Clique para colocar no texto. Depois é só preencher abaixo.</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map(({ key, label, icon: Icon }) => (
              <Button key={key} type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => onInsert(`{{${key}}}`)}>
                <Icon className="h-3 w-3" /> {label}
              </Button>
            ))}
          </div>
        </div>
      )}
      {showFields && (
        <>
          {(rawText == null || hasLink) && (
            <div className="space-y-1">
              <Label className="text-xs">Link</Label>
              <Input type="url" placeholder="https://..." value={value.link || ""} onChange={(e) => set({ link: e.target.value || null })} />
            </div>
          )}
          {(rawText == null || hasDate) && (
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
          )}
          {hasDate && value.date && (
            <p className="text-xs text-muted-foreground">
              Calculado sozinho: {vars.contagem_regressiva} · {vars.dia_semana_evento} · {vars.mes_evento}
            </p>
          )}
        </>
      )}
      {!hidePreview && previewText && (
        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3 w-3" /> Como a mensagem sai hoje</Label>
          <p className="whitespace-pre-wrap break-words rounded-md border bg-background p-2 text-xs">{previewText}</p>
        </div>
      )}
    </div>
  );
}

export { usesEventVariables };
