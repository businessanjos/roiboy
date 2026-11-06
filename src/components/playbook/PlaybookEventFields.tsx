import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/lib/utils";
import { Link2, Calendar, Clock, Hourglass, Eye, CalendarDays, Plus, Check, Wand2, Sparkles, AlertCircle, PenLine, Trash2, Loader2, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  detectEventPlaceholders,
  buildEventVariables,
  usesEventVariables,
  eventVariablesInText,
  requiredEventInputs,
  slugifyField,
  type PlaybookEventVars,
  type PlaybookCustomField,
} from "@/lib/playbookEventVars";

type Case = "upper" | "title" | "lower";
function CaseToggle({ value, onChange, sample }: { value: Case; onChange: (c: Case) => void; sample: string }) {
  const opts: Case[] = ["upper", "title", "lower"];
  const fmt = (c: Case) => (c === "upper" ? sample.toUpperCase() : c === "lower" ? sample.toLowerCase() : sample.charAt(0).toUpperCase() + sample.slice(1).toLowerCase());
  return (
    <div className="inline-flex rounded-md border bg-background p-0.5">
      {opts.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)}
          className={cn("rounded px-2 py-0.5 text-[11px] transition-colors", value === c ? "bg-primary/15 font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}>
          {fmt(c)}
        </button>
      ))}
    </div>
  );
}

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
  const [newName, setNewName] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const customs: PlaybookCustomField[] = value.customFields || [];
  const usedCustom = used.filter((k) => k.startsWith("campo:")).map((k) => k.slice(6));
  // Campos usados no texto que ainda não têm cadastro aparecem também.
  const customList: PlaybookCustomField[] = [
    ...customs,
    ...usedCustom.filter((sl) => !customs.some((c) => c.slug === sl)).map((sl) => ({ slug: sl, label: sl.replace(/_/g, " "), value: "" })),
  ];
  const setCustom = (slug: string, patch: Partial<PlaybookCustomField>) => {
    const exists = customs.some((c) => c.slug === slug);
    const base = exists ? customs : [...customs, customList.find((c) => c.slug === slug)!];
    set({ customFields: base.map((c) => (c.slug === slug ? { ...c, ...patch } : c)) });
  };
  const removeCustom = (f: PlaybookCustomField) => {
    if (onConvert && txt) onConvert(txt.split(`{{campo:${f.slug}}}`).join(f.value));
    set({ customFields: customs.filter((c) => c.slug !== f.slug) });
  };
  const createCustom = () => {
    const label = (newName || "").trim();
    if (!label) return;
    let slug = slugifyField(label);
    let i = 2;
    while (customs.some((c) => c.slug === slug)) slug = `${slugifyField(label)}_${i++}`;
    set({ customFields: [...customs, { slug, label, value: "" }] });
    onInsert?.(`{{campo:${slug}}}`);
    setNewName(null);
  };
  const runAi = async () => {
    if (!txt.trim()) return;
    setAiBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("playbook-ai-assist", { body: { text: txt } });
      if (error || !data?.text) throw new Error(data?.error || error?.message || "Não foi possível revisar agora.");
      if (data.text.trim() === txt.trim()) toast.success("Texto já está correto.");
      else setAiText(data.text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível revisar agora.");
    } finally {
      setAiBusy(false);
    }
  };
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
    if (keys.includes("dia_semana_evento")) patch.weekdayCase = v.weekdayCase;
    onConvert(detected.convert(keys));
    set(patch);
    setReviewing(false);
    setPicked({});
  };

  const needLink = needs.includes("link");
  const needDate = needs.includes("date");
  const needTime = needs.includes("time");
  const derived = used.filter((k) => ["dia_semana_evento", "contagem_regressiva", "mes_evento"].includes(k));
  const hasFields = needLink || needDate || needTime || customList.length > 0;
  const missing = (needLink && !value.link?.trim()) || (needDate && !value.date) || (needTime && !value.start)
    || customList.some((c) => usedCustom.includes(c.slug) && !c.value.trim());
  const labelOf = (k: string) => (k.startsWith("campo:") ? customList.find((c) => `campo:${c.slug}` === k)?.label || k.slice(6) : LABEL[k]);

  const aiBox = onConvert && txt.trim() && (
    aiText != null ? (
      <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
        <p className="flex items-center gap-1.5 text-xs font-medium"><Bot className="h-3.5 w-3.5 text-primary" /> Sugestão da IA (os campos automáticos foram mantidos)</p>
        <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-background p-2 text-sm">{aiText}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setAiText(null)}>Descartar</Button>
          <Button type="button" size="sm" onClick={() => { onConvert(aiText); setAiText(null); }}>Usar sugestão</Button>
        </div>
      </div>
    ) : (
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-xs" disabled={aiBusy} onClick={runAi}>
          {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5 text-primary" />}
          Revisar com IA
        </Button>
      </div>
    )
  );

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
      {newName == null ? (
        <button type="button" onClick={() => setNewName("")}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed bg-background px-2.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">
          <PenLine className="h-3 w-3 text-primary" /> Campo livre <Plus className="h-3 w-3" />
        </button>
      ) : (
        <span className="inline-flex items-center gap-1">
          <Input autoFocus value={newName} placeholder="Nome do campo (ex.: Local)" className="h-7 w-44 text-xs"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createCustom(); } if (e.key === "Escape") setNewName(null); }} />
          <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={createCustom} disabled={!newName.trim()}>Criar</Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setNewName(null)}>Cancelar</Button>
        </span>
      )}
    </div>
  );

  // Mensagem sem campos automáticos: só o atalho discreto (e a conversão, se houver texto à mão).
  if (!hasFields) {
    if (!chips && !convertBox && !aiBox) return null;
    return (
      <div className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-3">
        {chips}
        {convertBox}
        {aiBox}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Preencha os campos desta mensagem</p>
          <p className="text-xs text-muted-foreground">
            Usados no texto: {used.map(labelOf).join(", ") || "nenhum ainda"}. Ao trocar aqui, a mensagem se atualiza sozinha.
          </p>
        </div>
        {missing && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
            <AlertCircle className="h-3 w-3" /> Falta preencher
          </span>
        )}
      </div>

      {convertBox}
      {aiBox}

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
        {value.date && (derived.includes("mes_evento") || derived.includes("dia_semana_evento")) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            {derived.includes("mes_evento") && (
              <span className="flex items-center gap-2"><span className="text-muted-foreground">Mês:</span>
                <CaseToggle value={(value.monthCase as Case) || "upper"} onChange={(c) => set({ monthCase: c })} sample={vars.mes_evento || "novembro"} /></span>
            )}
            {derived.includes("dia_semana_evento") && (
              <span className="flex items-center gap-2"><span className="text-muted-foreground">Dia da semana:</span>
                <CaseToggle value={(value.weekdayCase as Case) || "lower"} onChange={(c) => set({ weekdayCase: c })} sample={vars.dia_semana_evento || "sexta-feira"} /></span>
            )}
          </div>
        )}
        {customList.map((f) => {
          const inText = usedCustom.includes(f.slug);
          return (
            <div key={f.slug} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <PenLine className="h-3.5 w-3.5 text-primary" />
                <Input value={f.label} onChange={(e) => setCustom(f.slug, { label: e.target.value })} className="h-7 max-w-[220px] border-transparent bg-transparent px-1 text-xs font-medium shadow-none hover:border-input focus:border-input" aria-label="Nome do campo" />
                {!inText && onInsert && (
                  <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => onInsert(`{{campo:${f.slug}}}`)}>inserir no texto</button>
                )}
                <button type="button" title="Remover campo (o texto dele fica escrito na mensagem)" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => removeCustom(f)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input placeholder="Escreva o que deve sair na mensagem" value={f.value} onChange={(e) => setCustom(f.slug, { value: e.target.value })}
                className={cn(inText && !f.value.trim() && "border-destructive/50")} />
            </div>
          );
        })}
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
