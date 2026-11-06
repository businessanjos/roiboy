import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/lib/utils";
import { CalendarClock, Link2, Calendar, Clock, Hourglass, Eye, CalendarDays, Plus, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Wand2 } from "lucide-react";
import { detectEventPlaceholders, buildEventVariables, usesEventVariables, type PlaybookEventVars } from "@/lib/playbookEventVars";

interface Props {
  value: PlaybookEventVars;
  onChange: (v: PlaybookEventVars) => void;
  /** Texto da mensagem para mostrar a prévia já preenchida. */
  previewText?: string | null;
  /** Texto bruto para saber quais campos estão no texto. */
  rawText?: string | null;
  /** Insere a variável no texto (botões de 1 clique). */
  onInsert?: (variable: string) => void;
  /** Esconde a prévia (quando ela é mostrada em outro lugar). */
  hidePreview?: boolean;
  /** Recebe o texto com os trechos escritos à mão trocados por campos. */
  onConvert?: (text: string) => void;
}

const QUICK = [
  { key: "link_evento", label: "Link", icon: Link2 },
  { key: "data_evento", label: "Data", icon: Calendar },
  { key: "dia_semana_evento", label: "Dia da semana", icon: CalendarDays },
  { key: "horario_evento", label: "Horário", icon: Clock },
  { key: "contagem_regressiva", label: "Contagem", icon: Hourglass },
  { key: "mes_evento", label: "Mês", icon: Calendar },
];

/** Campos variáveis da mensagem: a consultora troca só aqui e o texto se atualiza sozinho. */
export function PlaybookEventFields({ value, onChange, previewText, rawText, onInsert, hidePreview, onConvert }: Props) {
  const vars = buildEventVariables(value) as Record<string, string>;
  const set = (patch: Partial<PlaybookEventVars>) => onChange({ ...value, ...patch });
  const txt = rawText ?? "";
  const inText = (k: string) => txt.includes(`{{${k}}}`);
  const detected = onConvert && txt ? detectEventPlaceholders(txt) : null;
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [reviewing, setReviewing] = useState(false);
  const isPicked = (k: string) => picked[k] !== false;
  const applyConvert = () => {
    if (!detected || !onConvert) return;
    const keys = detected.fields.map((f) => f.key).filter(isPicked);
    const v = detected.vars;
    const patch: Partial<PlaybookEventVars> = {};
    if (keys.includes("link_evento")) patch.link = v.link;
    if (keys.some((k) => k !== "link_evento") && v.date) patch.date = v.date;
    if (keys.includes("horario_evento")) { patch.start = v.start; patch.end = v.end ?? null; }
    if (keys.includes("mes_evento")) patch.monthCase = v.monthCase;
    onConvert(detected.convert(keys));
    set(patch);
    setReviewing(false);
    setPicked({});
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CalendarClock className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Campos que mudam</p>
          <p className="text-xs text-muted-foreground">
            Coloque o campo no texto e preencha o valor aqui. Ao trocar o valor, a mensagem se atualiza sozinha.
          </p>
        </div>
      </div>

      {detected && detected.fields.length > 0 && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
          {!reviewing ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs">
                Encontrei no texto <b>{detected.fields.map((f) => f.label.toLowerCase()).join(", ")}</b> escritos à mão.
              </p>
              <Button type="button" size="sm" className="h-8 gap-1.5" onClick={() => setReviewing(true)}>
                <Wand2 className="h-3.5 w-3.5" /> Converter texto em campos
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium">Marque o que deve virar campo automático:</p>
              {detected.fields.map((f) => (
                <label key={f.key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={isPicked(f.key)} onCheckedChange={(c) => setPicked((p) => ({ ...p, [f.key]: !!c }))} />
                  <span className="w-28 shrink-0 font-medium">{f.label}</span>
                  <span className="truncate rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground">{f.found}</span>
                </label>
              ))}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => setReviewing(false)}>Cancelar</Button>
                <Button type="button" size="sm" onClick={applyConvert}>Converter</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {onInsert && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {QUICK.map(({ key, label, icon: Icon }) => {
            const used = inText(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onInsert(`{{${key}}}`)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  used ? "border-primary/50 bg-primary/10" : "bg-background hover:border-primary/40 hover:bg-muted",
                )}
                title={used ? "Já está no texto — clique para inserir de novo" : "Inserir no texto"}
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{vars[key] || "não preenchido"}</span>
                </span>
                {used ? <Check className="h-3.5 w-3.5 text-primary" /> : <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-3 rounded-lg bg-muted/40 p-3">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs"><Link2 className="h-3.5 w-3.5" /> Link</Label>
          <Input type="url" placeholder="Cole aqui o endereço (https://...)" value={value.link || ""} onChange={(e) => set({ link: e.target.value || null })} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5" /> Data do encontro</Label>
            <DateField value={value.date || ""} onChange={(e) => set({ date: e.target.value || null })} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" /> Início</Label>
            <Input type="time" value={value.start || ""} onChange={(e) => set({ start: e.target.value || null })} />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" /> Fim</Label>
            <Input type="time" value={value.end || ""} onChange={(e) => set({ end: e.target.value || null })} />
          </div>
        </div>
        {value.date && (
          <p className="text-xs text-muted-foreground">
            Calculado sozinho: <span className="font-medium text-foreground">{vars.contagem_regressiva}</span> · {vars.dia_semana_evento} · {vars.mes_evento}
          </p>
        )}
      </div>

      {!hidePreview && previewText && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Como a mensagem sai hoje</Label>
          <p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-background p-3 text-sm">{previewText}</p>
        </div>
      )}
    </div>
  );
}

export { usesEventVariables };
