import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const FN_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

type Field = {
  id: string;
  name: string;
  field_type: string;
  options: any;
  is_required: boolean;
};

type FormMeta = {
  id: string;
  account_id: string;
  title: string;
  description?: string | null;
  campaign_meta: Record<string, any>;
  appearance: Record<string, any>;
};

function uuid() {
  return (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2) + Date.now();
}

function getOrCreateSessionToken(slug: string) {
  const k = `roy_campaign_session_${slug}`;
  let v = localStorage.getItem(k);
  if (!v) {
    v = uuid();
    localStorage.setItem(k, v);
  }
  return v;
}

function readUtm() {
  const p = new URLSearchParams(window.location.search);
  return {
    source: p.get("utm_source") || undefined,
    medium: p.get("utm_medium") || undefined,
    campaign: p.get("utm_campaign") || undefined,
    content: p.get("utm_content") || undefined,
    term: p.get("utm_term") || undefined,
  };
}

export default function PublicCampaignForm() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormMeta | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ thanks?: string; redirect?: string } | null>(null);

  const sessionToken = useMemo(() => (slug ? getOrCreateSessionToken(slug) : ""), [slug]);
  const utm = useMemo(() => readUtm(), []);
  const fieldEnterTime = useRef<number>(0);
  const startedRef = useRef(false);

  // Load form
  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await fetch(`${FN_BASE}/get-campaign-form?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Formulário indisponível");
          setLoading(false);
          return;
        }
        setForm(data.form);
        setFields(data.fields || []);
        setLoading(false);
        // view event
        track("view");
      } catch (e) {
        setError("Erro ao carregar formulário");
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function track(event: string, field_id?: string, seconds?: number) {
    if (!form) return;
    try {
      await fetch(`${FN_BASE}/track-campaign-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          form_id: form.id,
          session_token: sessionToken,
          field_id,
          seconds_on_field: seconds,
          utm,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
        }),
      });
    } catch {
      /* swallow */
    }
  }

  // Track field entry/exit
  useEffect(() => {
    if (!form || done || fields.length === 0) return;
    const field = fields[step];
    if (!field) return;
    fieldEnterTime.current = Date.now();
    if (!startedRef.current) {
      startedRef.current = true;
      track("start");
    }
    track("field_focus", field.id);
    return () => {
      const seconds = (Date.now() - fieldEnterTime.current) / 1000;
      track("field_blur", field.id, seconds);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form, done]);

  function setValue(id: string, v: any) {
    setAnswers((prev) => ({ ...prev, [id]: v }));
  }

  function validateStep(): string | null {
    const f = fields[step];
    if (!f) return null;
    const v = answers[f.id];
    if (f.is_required && (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0))) {
      return "Campo obrigatório";
    }
    if (f.field_type === "email" || f.name.toLowerCase().includes("email")) {
      if (v && !String(v).includes("@")) return "E-mail inválido";
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) {
      track("validation_error", fields[step]?.id);
      toast.error(err);
      return;
    }
    if (step < fields.length - 1) setStep(step + 1);
    else submit();
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  async function submit() {
    if (!form) return;
    setSubmitting(true);
    // Extract contact from answers
    let email = "", phone = "", full_name = "";
    for (const f of fields) {
      const v = answers[f.id];
      const lower = (f.name || "").toLowerCase();
      if (!email && (f.field_type === "email" || lower.includes("email") || lower.includes("e-mail"))) email = v || "";
      if (!phone && (lower.includes("telefone") || lower.includes("phone") || lower.includes("celular") || lower.includes("whats"))) phone = v || "";
      if (!full_name && (lower.includes("nome") || lower.includes("name"))) full_name = v || "";
    }
    try {
      const res = await fetch(`${FN_BASE}/submit-campaign-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: form.id,
          session_token: sessionToken,
          responses: answers,
          contact: { email, phone, full_name },
          utm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao enviar");
        setSubmitting(false);
        return;
      }
      setDone({ thanks: data.thanks_message, redirect: data.redirect_url });
      if (data.redirect_url) {
        setTimeout(() => { window.location.href = data.redirect_url; }, 1500);
      }
    } catch {
      toast.error("Erro de rede ao enviar");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-2xl font-semibold">Formulário indisponível</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
          <h1 className="text-2xl font-semibold">Obrigado!</h1>
          <p className="text-muted-foreground">
            {done.thanks || "Recebemos sua resposta. Em breve entraremos em contato."}
          </p>
          {done.redirect && (
            <p className="text-xs text-muted-foreground">Redirecionando...</p>
          )}
        </div>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground">Este formulário ainda não tem perguntas configuradas.</p>
      </div>
    );
  }

  const field = fields[step];
  const value = answers[field.id] ?? "";
  const progress = ((step + 1) / fields.length) * 100;
  const accent = form?.appearance?.primary_color || form?.campaign_meta?.primary_color;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="w-full px-4 py-4 border-b border-border/40">
        <Progress value={progress} className="h-1" />
        <div className="max-w-2xl mx-auto mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{form?.title}</span>
          <span>Pergunta {step + 1} de {fields.length}</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-6">
          <div>
            <Label className="text-2xl font-semibold leading-tight block mb-2">
              {field.name}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {form?.description && step === 0 && (
              <p className="text-sm text-muted-foreground">{form.description}</p>
            )}
          </div>

          <FieldInput field={field} value={value} onChange={(v) => setValue(field.id, v)} autoFocus />

          <div className="flex items-center justify-between pt-4">
            <Button variant="ghost" onClick={prev} disabled={step === 0 || submitting}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <Button
              onClick={next}
              disabled={submitting}
              style={accent ? { backgroundColor: accent } : undefined}
              className="min-w-[120px]"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : step === fields.length - 1 ? (
                <>Enviar <ArrowRight className="w-4 h-4 ml-1" /></>
              ) : (
                <>Continuar <ArrowRight className="w-4 h-4 ml-1" /></>
              )}
            </Button>
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-muted-foreground py-4 border-t border-border/40">
        Powered by Roy
      </footer>
    </div>
  );
}

function FieldInput({
  field, value, onChange, autoFocus,
}: { field: Field; value: any; onChange: (v: any) => void; autoFocus?: boolean }) {
  const ft = field.field_type;
  const lower = (field.name || "").toLowerCase();
  const isLongText = ft === "text" && (lower.includes("descri") || lower.includes("comentário") || lower.includes("mensagem"));

  if (ft === "select" || (Array.isArray(field.options) && field.options.length > 0 && ft !== "multi_select")) {
    const opts = Array.isArray(field.options) ? field.options : [];
    return (
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>
          {opts.map((o: any, i: number) => {
            const v = typeof o === "string" ? o : o?.value ?? o?.label ?? String(i);
            const lbl = typeof o === "string" ? o : o?.label ?? o?.value ?? String(i);
            return <SelectItem key={v} value={String(v)}>{lbl}</SelectItem>;
          })}
        </SelectContent>
      </Select>
    );
  }

  if (ft === "multi_select") {
    const opts = Array.isArray(field.options) ? field.options : [];
    const arr: string[] = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-2">
        {opts.map((o: any, i: number) => {
          const v = typeof o === "string" ? o : o?.value ?? o?.label ?? String(i);
          const lbl = typeof o === "string" ? o : o?.label ?? o?.value ?? String(i);
          const active = arr.includes(String(v));
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(active ? arr.filter((x) => x !== String(v)) : [...arr, String(v)])}
              className={`px-4 py-2 rounded-full border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/60"}`}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    );
  }

  if (ft === "number" || ft === "currency") {
    return (
      <Input
        type="number"
        autoFocus={autoFocus}
        className="h-12 text-base"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (ft === "date") {
    return (
      <Input
        type="date"
        autoFocus={autoFocus}
        className="h-12 text-base"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (isLongText) {
    return (
      <Textarea
        autoFocus={autoFocus}
        rows={5}
        className="text-base"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // Default: text / email / phone
  const isEmail = lower.includes("email") || lower.includes("e-mail");
  const isPhone = lower.includes("telefone") || lower.includes("phone") || lower.includes("celular") || lower.includes("whats");
  return (
    <Input
      type={isEmail ? "email" : isPhone ? "tel" : "text"}
      autoFocus={autoFocus}
      className="h-12 text-base"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
