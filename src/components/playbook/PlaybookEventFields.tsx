import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/lib/utils";
import { Link2, Calendar, Clock, Hourglass, Eye, CalendarDays, Plus, Check, Wand2, Sparkles, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  detectEventPlaceholders,
  buildEventVariables,
  usesEventVariables,
  eventVariablesInText,
  requiredEventInputs,
  type PlaybookEventVars,
} from "@/lib/playbookEventVars";

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
const LABEL: Record<string, string> = Object.fromEntries(QUICK.map((q) => [q.key, q.label]));

/** Campos variáveis da mensagem: só aparecem os que o texto usa; o resto fica como atalho discreto. */
export function PlaybookEventFields({ value, onChange, previewText, rawText, onInsert, hidePreview, onConvert }: Props) {
  const vars = buildEventVariables(value) as Record<string, string>;
  const set = (patch: Partial<PlaybookEventVars>) => onChange({ ...value, ...patch });
  const txt = rawText ?? "";
  // Sem texto de referência (envio rápido antigo), mostra tudo que já tinha valor.
  const used = rawText != null ? eventVariablesInText(txt) : QUICK.map((q) => q.key);
  const needs = rawText != null ? requiredEventInputs(txt) : (["link", "date", "time"] as const).slice();
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

  const needLink = needs.includes("link");
  const needDate = needs.includes("date");
  const needTime = needs.includes("time");
  const derived = used.filter((k) => ["dia_semana_evento", "contagem_regressiva", "mes_evento"].includes(k));
  const hasFields = needLink || needDate || needTime;
  const missing = (needLink && !value.link?.trim()) || (needDate && !value.date) || (needTime && !value.start);

  const convertBox = detected && detected.fields.length > 0 && (
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
  );

  const chips = onInsert && (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Inserir campo automático:
      </span>
      {QUICK.map(({ key, label, icon: Icon }) => {
        const on = used.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onInsert(`{{${key}}}`)}
            title={on ? "Já está no texto. Clique para inserir de novo onde está o cursor" : "Inserir onde está o cursor"}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors",
              on ? "border-primary/50 bg-primary/10 text-foreground" : "bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            <Icon className="h-3 w-3 text-primary" />
            {label}
            {on ? <Check className="h-3 w-3 text-primary" /> : <Plus className="h-3 w-3" />}
          </button>
        );
      })}
    </div>
  );

  // Mensagem sem campos automáticos: só o atalho discreto (e a conversão, se houver texto à mão).
  if (!hasFields) {
    if (!chips && !convertBox) return null;
    return (
      <div className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-3">
        {chips}
        {convertBox}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Preencha os campos desta mensagem</p>
          <p className="text-xs text-muted-foreground">
            Usados no texto: {used.map((k) => LABEL[k]).join(", ")}. Ao trocar aqui, a mensagem se atualiza sozinha.
          </p>
        </div>
        {missing && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
            <AlertCircle className="h-3 w-3" /> Falta preencher
          </span>
        )}
      </div>

      {convertBox}

      <div className="space-y-3 rounded-lg bg-muted/40 p-3">
        {needLink && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs"><Link2 className="h-3.5 w-3.5" /> Link</Label>
            <Input type="url" placeholder="Cole aqui o endereço (https://...)" value={value.link || ""} onChange={(e) => set({ link: e.target.value || null })} className={cn(!value.link?.trim() && "border-destructive/50")} />
          </div>
        )}
        {(needDate || needTime) && (
          <div className={cn("grid grid-cols-1 gap-3", needDate && needTime ? "sm:grid-cols-[1.4fr_1fr_1fr]" : needTime ? "sm:grid-cols-2" : "")}>
            {needDate && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs"><Calendar className="h-3.5 w-3.5" /> Data do encontro</Label>
                <div className={cn(!value.date && "rounded-md ring-1 ring-destructive/50")}>
                  <DateField value={value.date || ""} onChange={(e) => set({ date: e.target.value || null })} />
                </div>
              </div>
            )}
            {needTime && (
              <>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" /> Início</Label>
                  <Input type="time" value={value.start || ""} onChange={(e) => set({ start: e.target.value || null })} className={cn(!value.start && "border-destructive/50")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" /> Fim (opcional)</Label>
                  <Input type="time" value={value.end || ""} onChange={(e) => set({ end: e.target.value || null })} />
                </div>
              </>
            )}
          </div>
        )}
        {derived.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {value.date ? (
              <>Calculado pela data: {derived.map((k) => (
                <span key={k} className="mr-2 inline-block"><span className="text-muted-foreground">{LABEL[k]}:</span> <b className="text-foreground">{vars[k]}</b></span>
              ))}</>
            ) : (
              <>{derived.map((k) => LABEL[k]).join(", ")} {derived.length > 1 ? "saem" : "sai"} sozinho da data. Escolha a data acima.</>
            )}
          </p>
        )}
      </div>

      {chips && <div className="border-t pt-3">{chips}</div>}

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
