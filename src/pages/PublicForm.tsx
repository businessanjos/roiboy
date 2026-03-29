import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollDatePicker } from "@/components/ui/ScrollDatePicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon, Loader2, CheckCircle2, AlertCircle, Send, User, Phone,
  ChevronRight, ChevronLeft, ArrowRight,
} from "lucide-react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { motion, AnimatePresence } from "framer-motion";
import {
  FormAppearance,
  DEFAULT_APPEARANCE,
  CARD_WIDTH_OPTIONS,
  BORDER_RADIUS_OPTIONS,
} from "@/components/forms/FormAppearance.types";

/* ─── Types ─────────────────────────────────────────────────────── */

interface FormData {
  id: string;
  title: string;
  description: string | null;
  fields: string[];
  require_client_info: boolean;
  appearance?: FormAppearance;
}

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  options: any;
  is_required: boolean;
}

interface ClientData {
  id: string;
  name: string;
  phone: string;
}

interface FieldStep {
  title: string;
  fields: CustomField[];
  type: "client_info" | "fields";
}

/* ─── Helpers ───────────────────────────────────────────────────── */

const DATE_KEYWORDS = ["data", "date", "nascimento", "aniversário", "aniversario", "birthday", "vencimento"];

const PERSONAL_KEYWORDS = [
  "nascimento",
  "endereço", "endereco", "cep", "profissão", "profissao",
  "instagram", "estado civil", "cônjuge", "conjuge", "casamento",
  "emergência", "emergencia", "cpf", "rg", "documento",
];

function isPersonalField(field: CustomField): boolean {
  const lower = field.name.toLowerCase();
  return PERSONAL_KEYWORDS.some((kw) => lower.includes(kw));
}

function isDateField(field: CustomField): boolean {
  if (field.field_type === "date") return true;
  const lower = field.name.toLowerCase();
  return DATE_KEYWORDS.some((kw) => lower.includes(kw));
}

function isCivilStatusField(field: CustomField): boolean {
  const lower = field.name.toLowerCase();
  return ["estado civil"].some((kw) => lower.includes(kw));
}

const CIVIL_STATUS_OPTIONS = [
  "Solteira (o)",
  "Casada (o)",
  "União Estável",
  "Divorciada (o)",
  "Separada (o)",
  "Viúva (o)",
];

const CIVIL_STATUS_WITH_SPOUSE = ["Casada (o)", "União Estável"];

function isSpouseField(field: CustomField): boolean {
  const lower = field.name.toLowerCase();
  return ["cônjuge", "conjuge"].some((kw) => lower.includes(kw));
}

function isPhoneField(field: CustomField): boolean {
  if (field.field_type === "phone") return true;
  const lower = field.name.toLowerCase();
  return ["telefone", "celular", "whatsapp", "phone", "tel"].some((kw) => lower.includes(kw));
}

const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  "emergência": "Contato de emergência",
  "emergencia": "Contato de emergência",
};

function getFieldLabel(field: CustomField): string {
  const lower = field.name.toLowerCase();
  for (const [keyword, label] of Object.entries(FIELD_LABEL_OVERRIDES)) {
    if (lower.includes(keyword)) return label;
  }
  return field.name;
}

function splitSpouseFields(fields: CustomField[]): CustomField[] {
  const result: CustomField[] = [];
  for (const field of fields) {
    if (isSpouseField(field)) {
      result.push({
        ...field,
        id: `${field.id}__nome`,
        name: "Nome do Cônjuge",
        is_required: field.is_required,
      });
      result.push({
        ...field,
        id: `${field.id}__profissao`,
        name: "Profissão do Cônjuge",
        is_required: false,
      });
    } else {
      result.push(field);
    }
  }
  return result;
}

function buildSteps(
  customFields: CustomField[],
  requireClientInfo: boolean,
  hasClientId: boolean
): FieldStep[] {
  const steps: FieldStep[] = [];

  // Separate personal fields from the rest
  const personalFields = splitSpouseFields(customFields.filter(isPersonalField));
  const otherFields = splitSpouseFields(customFields.filter((f) => !isPersonalField(f)));

  // Step 1: Client info + personal fields merged
  if (requireClientInfo && !hasClientId) {
    steps.push({ title: "Dados Pessoais", fields: personalFields, type: "client_info" });
  } else if (personalFields.length > 0) {
    steps.push({ title: "Dados Pessoais", fields: personalFields, type: "fields" });
  }

  // Remaining fields grouped by max 3
  const MAX_PER_STEP = 3;
  let currentBatch: CustomField[] = [];
  let stepIndex = 2;

  const flushBatch = () => {
    if (currentBatch.length > 0) {
      steps.push({
        title: `Etapa ${stepIndex}`,
        fields: [...currentBatch],
        type: "fields",
      });
      stepIndex++;
      currentBatch = [];
    }
  };

  for (const field of otherFields) {
    currentBatch.push(field);
    if (currentBatch.length >= MAX_PER_STEP) flushBatch();
  }
  flushBatch();

  return steps;
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 2) return digits.length > 0 ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function PublicForm() {
  const { formId } = useParams();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get("clientId") || searchParams.get("client");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [clientData, setClientData] = useState<ClientData | null>(null);

  const [responses, setResponses] = useState<Record<string, any>>({});
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => { fetchFormData(); }, [formId, clientId]);

  const fetchFormData = async () => {
    if (!formId) { setError("Formulário não encontrado"); setLoading(false); return; }
    try {
      const { data, error } = await supabase.functions.invoke("get-public-form", {
        body: { formId, clientId },
      });
      if (error) throw error;
      if (data.error) { setError(data.error); setLoading(false); return; }
      setFormData(data.form);
      setClientData(data.client);
      setCustomFields(data.customFields || []);
      if (data.client) {
        setClientName(data.client.name || "");
        setClientPhone(data.client.phone || "");
      }
    } catch (err: any) {
      console.error("Error fetching form:", err);
      setError("Erro ao carregar formulário");
    } finally {
      setLoading(false);
    }
  };

  const steps = useMemo(
    () => buildSteps(customFields, formData?.require_client_info || false, !!clientId),
    [customFields, formData?.require_client_info, clientId]
  );


  const isSpouseFieldVisible = useMemo(() => {
    const civilStatusField = customFields.find(isCivilStatusField);
    if (!civilStatusField) return true;
    const civilValue = responses[civilStatusField.id];
    return CIVIL_STATUS_WITH_SPOUSE.includes(civilValue);
  }, [customFields, responses]);

  const totalSteps = steps.length;
  const isLastStep = currentStep === totalSteps - 1;
  const isSingleStep = totalSteps <= 1;
  const appearance = { ...DEFAULT_APPEARANCE, ...formData?.appearance };
  const currentStepData = steps[currentStep];
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 100;

  /* ─── Validation ────────────────────────────────────────────── */

  const isFieldEmpty = (field: CustomField, value: any): boolean => {
    if (value === undefined || value === null) return true;
    switch (field.field_type) {
      case "boolean": return value !== true && value !== false;
      case "multi_select": return !Array.isArray(value) || value.length === 0;
      case "number":
      case "currency": return value === "" || isNaN(value);
      default: return !value || (typeof value === "string" && !value.trim());
    }
  };

  const validateCurrentStep = (): boolean => {
    const step = steps[currentStep];
    if (!step) return true;
    const errors: Record<string, boolean> = {};
    if (step.type === "client_info") {
      if (!clientName.trim()) errors.clientName = true;
      if (!clientPhone.trim()) errors.clientPhone = true;
    } else {
      step.fields.forEach((f) => {
        if (f.is_required && isFieldEmpty(f, responses[f.id])) errors[f.id] = true;
      });
    }
    setFieldErrors((prev) => ({ ...prev, ...errors }));
    if (Object.values(errors).some(Boolean)) {
      toast.error("Preencha os campos obrigatórios");
      return false;
    }
    return true;
  };

  const handleNext = () => { if (validateCurrentStep() && !isLastStep) { setCurrentStep((s) => s + 1); } };
  const handleBack = () => { if (currentStep > 0) setCurrentStep((s) => s - 1); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCurrentStep()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-form-response", {
        body: {
          formId,
          clientId: clientData?.id || null,
          clientName: clientName.trim() || null,
          clientPhone: clientPhone.trim() || null,
          responses,
        },
      });
      if (error) throw error;
      if (data.error) { toast.error(data.error); return; }
      setSubmitted(true);
    } catch (err: any) {
      console.error("Error submitting form:", err);
      toast.error("Erro ao enviar resposta");
    } finally {
      setSubmitting(false);
    }
  };

  const updateResponse = (fieldId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
    if (fieldErrors[fieldId]) setFieldErrors((prev) => ({ ...prev, [fieldId]: false }));
  };

  /* ─── Premium Dark Theme Tokens ────────────────────────────── */

  const dark = {
    bg: "#0a0a0b",
    surface: "#141416",
    surfaceHover: "#1a1a1e",
    border: "rgba(255,255,255,0.06)",
    borderHover: "rgba(255,255,255,0.12)",
    borderActive: appearance.primary_color,
    text: "#f0f0f2",
    textSecondary: "rgba(240,240,242,0.55)",
    textTertiary: "rgba(240,240,242,0.3)",
    accent: appearance.primary_color,
    accentGlow: `${appearance.primary_color}18`,
    accentSubtle: `${appearance.primary_color}0C`,
    error: "#ef4444",
    errorBg: "rgba(239,68,68,0.08)",
  };

  /* ─── Field Renderer ───────────────────────────────────────── */

  const renderField = (field: CustomField) => {
    const value = responses[field.id];
    const hasError = fieldErrors[field.id];

    const baseInputClass = cn(
      "w-full h-12 rounded-lg border bg-transparent px-4 text-[15px] outline-none transition-all duration-200",
      "placeholder:text-[rgba(240,240,242,0.25)]",
      "focus:border-transparent focus:ring-2",
      hasError ? "ring-2 ring-red-500/50 border-red-500/30" : ""
    );

    const inputStyles: React.CSSProperties = {
      backgroundColor: dark.surface,
      color: dark.text,
      borderColor: hasError ? "rgba(239,68,68,0.3)" : dark.border,
      // @ts-ignore
      "--tw-ring-color": dark.accent,
    };

    // Smart date detection
    if (isDateField(field)) {
      const parsedDate = (() => {
        if (!value) return undefined;
        if (value instanceof Date) return value;

        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const [year, month, day] = value.split("-").map(Number);
          return new Date(year, month - 1, day);
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date;
      })();

      return (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "w-full h-12 rounded-lg border flex items-center gap-3 px-4 text-[15px] outline-none transition-all duration-200 group",
                "hover:border-[rgba(255,255,255,0.12)]",
                hasError && "ring-2 ring-red-500/50 border-red-500/30"
              )}
              style={{
                backgroundColor: dark.surface,
                color: dark.text,
                borderColor: value ? dark.borderActive : dark.border,
              }}
            >
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors"
                style={{ backgroundColor: value ? dark.accentGlow : "rgba(255,255,255,0.04)" }}
              >
                <CalendarIcon className="h-4 w-4" style={{ color: value ? dark.accent : dark.textTertiary }} />
              </div>
              <span style={{ color: value ? dark.text : dark.textTertiary }}>
                {parsedDate ? format(parsedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecionar data"}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 border-0 shadow-2xl shadow-black/40 pointer-events-auto"
            align="start"
            style={{ backgroundColor: "rgb(24,24,27)" }}
          >
            <ScrollDatePicker
              value={parsedDate}
              onChange={(date) => updateResponse(field.id, format(date, "yyyy-MM-dd"))}
              maxYear={new Date().getFullYear()}
              minYear={1930}
            />
          </PopoverContent>
        </Popover>
      );
    }

    // Civil status detection
    if (isCivilStatusField(field)) {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "w-full h-12 rounded-lg border flex items-center justify-between px-4 text-[15px] outline-none transition-all duration-200",
                "hover:border-[rgba(255,255,255,0.12)]",
                hasError && "ring-2 ring-red-500/50 border-red-500/30"
              )}
              style={{
                backgroundColor: dark.surface,
                color: dark.text,
                borderColor: value ? dark.borderActive : dark.border,
              }}
            >
              <span style={{ color: value ? dark.text : dark.textTertiary }}>
                {value || "Selecionar estado civil"}
              </span>
              <ChevronRight className="h-4 w-4 rotate-90" style={{ color: dark.textTertiary }} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-1 border shadow-2xl shadow-black/40 pointer-events-auto"
            align="start"
            style={{ backgroundColor: dark.surface, borderColor: dark.border }}
          >
            {CIVIL_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className="w-full text-left px-3 py-2.5 rounded-md text-[15px] transition-colors hover:bg-white/5"
                style={{ color: value === opt ? dark.accent : dark.text }}
                onClick={() => {
                  updateResponse(field.id, opt);
                  // Close popover by blurring
                  (document.activeElement as HTMLElement)?.blur();
                }}
              >
                {opt}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      );
    }

    // Phone detection
    if (isPhoneField(field)) {
      return (
        <div className="relative">
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
          >
            <Phone className="h-4 w-4" style={{ color: dark.textTertiary }} />
          </div>
          <input
            type="tel"
            value={value || ""}
            onChange={(e) => updateResponse(field.id, formatPhone(e.target.value))}
            placeholder="(11) 99999-9999"
            className={cn(baseInputClass, "pl-14")}
            style={inputStyles}
          />
        </div>
      );
    }

    switch (field.field_type) {
      case "boolean":
        return (
          <div className="grid grid-cols-2 gap-3">
            {[{ label: "Sim", val: true }, { label: "Não", val: false }].map(({ label, val }) => {
              const selected = value === val;
              return (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    "h-12 rounded-lg border text-[15px] font-medium transition-all duration-200",
                    "hover:border-[rgba(255,255,255,0.12)]",
                    selected && "ring-1"
                  )}
                  style={{
                    backgroundColor: selected ? dark.accentGlow : dark.surface,
                    borderColor: selected ? dark.accent : dark.border,
                    color: selected ? dark.text : dark.textSecondary,
                    // @ts-ignore
                    "--tw-ring-color": dark.accent,
                  }}
                  onClick={() => updateResponse(field.id, val)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        );

      case "select":
      case "single_choice": {
        const opts = Array.isArray(field.options) ? field.options : [];
        return (
          <div className="space-y-2">
            {opts.map((opt: any) => {
              const optValue = typeof opt === "string" ? opt : opt.value;
              const optLabel = typeof opt === "string" ? opt : opt.label;
              const selected = value === optValue;
              return (
                <button
                  key={optValue}
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-3 px-4 h-12 rounded-lg border text-left transition-all duration-200",
                    "hover:border-[rgba(255,255,255,0.12)]"
                  )}
                  style={{
                    backgroundColor: selected ? dark.accentGlow : dark.surface,
                    borderColor: selected ? dark.accent : dark.border,
                  }}
                  onClick={() => updateResponse(field.id, optValue)}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors"
                    style={{ borderColor: selected ? dark.accent : "rgba(255,255,255,0.15)" }}
                  >
                    {selected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: dark.accent }}
                      />
                    )}
                  </div>
                  <span className="text-[15px]" style={{ color: selected ? dark.text : dark.textSecondary }}>
                    {optLabel}
                  </span>
                </button>
              );
            })}
          </div>
        );
      }

      case "multi_select":
      case "multiple_choice": {
        const opts = Array.isArray(field.options) ? field.options : [];
        const sel = (value as string[]) || [];
        return (
          <div className="space-y-2">
            {opts.map((opt: any) => {
              const optValue = typeof opt === "string" ? opt : opt.value;
              const optLabel = typeof opt === "string" ? opt : opt.label;
              const on = sel.includes(optValue);
              return (
                <button
                  key={optValue}
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-3 px-4 h-12 rounded-lg border text-left transition-all duration-200",
                    "hover:border-[rgba(255,255,255,0.12)]"
                  )}
                  style={{
                    backgroundColor: on ? dark.accentGlow : dark.surface,
                    borderColor: on ? dark.accent : dark.border,
                  }}
                  onClick={() => updateResponse(field.id, on ? sel.filter((v) => v !== optValue) : [...sel, optValue])}
                >
                  <div
                    className="w-4 h-4 rounded-[4px] border-2 shrink-0 flex items-center justify-center transition-colors"
                    style={{
                      borderColor: on ? dark.accent : "rgba(255,255,255,0.15)",
                      backgroundColor: on ? dark.accent : "transparent",
                    }}
                  >
                    {on && (
                      <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 3.5L3.5 6L9 1" stroke="#0a0a0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </motion.svg>
                    )}
                  </div>
                  <span className="text-[15px]" style={{ color: on ? dark.text : dark.textSecondary }}>
                    {optLabel}
                  </span>
                </button>
              );
            })}
          </div>
        );
      }

      case "number":
      case "currency":
        return (
          <div className="relative">
            {field.field_type === "currency" && (
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: dark.textTertiary }}>
                R$
              </span>
            )}
            <input
              type="number"
              value={value || ""}
              onChange={(e) => updateResponse(field.id, e.target.value ? Number(e.target.value) : null)}
              placeholder={field.field_type === "currency" ? "0,00" : "0"}
              step={field.field_type === "currency" ? "0.01" : "1"}
              className={cn(baseInputClass, field.field_type === "currency" && "pl-10")}
              style={inputStyles}
            />
          </div>
        );

      case "long_text":
        return (
          <textarea
            value={value || ""}
            onChange={(e) => updateResponse(field.id, e.target.value)}
            placeholder="Digite sua resposta..."
            rows={4}
            className={cn(
              "w-full rounded-lg border bg-transparent px-4 py-3 text-[15px] outline-none resize-none transition-all duration-200",
              "placeholder:text-[rgba(240,240,242,0.25)]",
              "focus:border-transparent focus:ring-2",
              hasError && "ring-2 ring-red-500/50 border-red-500/30"
            )}
            style={inputStyles}
          />
        );

      case "text":
      default:
        return (
          <input
            type="text"
            value={value || ""}
            onChange={(e) => updateResponse(field.id, e.target.value)}
            placeholder="Digite sua resposta..."
            className={baseInputClass}
            style={inputStyles}
          />
        );
    }
  };

  /* ─── Screens ─────────────────────────────────────────────────── */

  if (loading) return <LoadingScreen message="Carregando formulário..." />;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: dark.bg }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm rounded-xl border p-10 text-center"
          style={{ backgroundColor: dark.surface, borderColor: dark.border }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: dark.errorBg }}>
            <AlertCircle className="h-6 w-6" style={{ color: dark.error }} />
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: dark.text }}>Formulário indisponível</h2>
          <p className="text-sm" style={{ color: dark.textSecondary }}>{error}</p>
        </motion.div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: dark.bg }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm rounded-xl border p-10 text-center"
          style={{ backgroundColor: dark.surface, borderColor: dark.border }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: dark.accentGlow }}
          >
            <CheckCircle2 className="h-7 w-7" style={{ color: dark.accent }} />
          </motion.div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: dark.text }}>Resposta enviada</h2>
          <p className="text-sm leading-relaxed" style={{ color: dark.textSecondary }}>
            Obrigado por preencher o formulário.<br />
            Suas respostas foram registradas com sucesso.
          </p>
        </motion.div>
      </div>
    );
  }

  /* ─── Main Form ───────────────────────────────────────────────── */

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start py-8 sm:py-16 px-4"
      style={{ backgroundColor: dark.bg }}
    >
      {/* Subtle radial gradient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${dark.accentGlow} 0%, transparent 70%)`,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-lg relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          {appearance.logo_url && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex justify-center mb-6"
            >
              <img src={appearance.logo_url} alt="Logo" className="h-10 sm:h-12 object-contain" />
            </motion.div>
          )}

          {appearance.show_title !== false && (
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em] mb-2"
              style={{ color: dark.text }}
            >
              {formData?.title}
            </motion.h1>
          )}

          {formData?.description && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-[15px] leading-relaxed max-w-md mx-auto"
              style={{ color: dark.textSecondary }}
            >
              {formData.description}
            </motion.p>
          )}

          {clientData && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: dark.accentSubtle,
                border: `1px solid ${dark.accentGlow}`,
                color: dark.accent,
              }}
            >
              <User className="w-3 h-3" />
              {clientData.name}
            </motion.div>
          )}
        </div>

        {/* Progress */}
        {!isSingleStep && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium tracking-wide uppercase" style={{ color: dark.textTertiary }}>
                {currentStepData?.type === "client_info" ? "Seus dados" : currentStepData?.title}
              </span>
              <span className="text-xs tabular-nums" style={{ color: dark.textTertiary }}>
                {currentStep + 1}/{totalSteps}
              </span>
            </div>
            <div className="h-[3px] rounded-full w-full" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: dark.accent }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          </div>
        )}

        {/* Card */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: dark.surface, borderColor: dark.border }}
        >
          <form onSubmit={handleSubmit}>
            <div className="p-6 sm:p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-6"
                >
                  {/* Client Info Step */}
                  {currentStepData?.type === "client_info" && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-1.5" style={{ color: fieldErrors.clientName ? dark.error : dark.textSecondary }}>
                          Nome completo
                          <span style={{ color: dark.accent }}>*</span>
                        </label>
                        <div className="relative">
                          <div
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                          >
                            <User className="h-4 w-4" style={{ color: dark.textTertiary }} />
                          </div>
                          <input
                            value={clientName}
                            onChange={(e) => { setClientName(e.target.value); if (fieldErrors.clientName) setFieldErrors((p) => ({ ...p, clientName: false })); }}
                            placeholder="Seu nome"
                            className={cn(
                              "w-full h-12 rounded-lg border bg-transparent pl-14 pr-4 text-[15px] outline-none transition-all duration-200",
                              "placeholder:text-[rgba(240,240,242,0.25)] focus:ring-2",
                              fieldErrors.clientName && "ring-2 ring-red-500/50 border-red-500/30"
                            )}
                            style={{
                              backgroundColor: dark.surface,
                              color: dark.text,
                              borderColor: dark.border,
                              // @ts-ignore
                              "--tw-ring-color": dark.accent,
                            }}
                          />
                        </div>
                        {fieldErrors.clientName && <p className="text-xs" style={{ color: dark.error }}>Campo obrigatório</p>}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-1.5" style={{ color: fieldErrors.clientPhone ? dark.error : dark.textSecondary }}>
                          Telefone
                          <span style={{ color: dark.accent }}>*</span>
                        </label>
                        <div className="relative">
                          <div
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                          >
                            <Phone className="h-4 w-4" style={{ color: dark.textTertiary }} />
                          </div>
                          <input
                            value={clientPhone}
                            onChange={(e) => { setClientPhone(formatPhone(e.target.value)); if (fieldErrors.clientPhone) setFieldErrors((p) => ({ ...p, clientPhone: false })); }}
                            placeholder="(11) 99999-9999"
                            className={cn(
                              "w-full h-12 rounded-lg border bg-transparent pl-14 pr-4 text-[15px] outline-none transition-all duration-200",
                              "placeholder:text-[rgba(240,240,242,0.25)] focus:ring-2",
                              fieldErrors.clientPhone && "ring-2 ring-red-500/50 border-red-500/30"
                            )}
                            style={{
                              backgroundColor: dark.surface,
                              color: dark.text,
                              borderColor: dark.border,
                              // @ts-ignore
                              "--tw-ring-color": dark.accent,
                            }}
                          />
                        </div>
                        {fieldErrors.clientPhone && <p className="text-xs" style={{ color: dark.error }}>Campo obrigatório</p>}
                      </div>

                      {/* Personal custom fields merged into this step */}
                      {currentStepData.fields.filter(f => !isSpouseField(f) || isSpouseFieldVisible).map((field, index) => (
                        <motion.div
                          key={field.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: (index + 2) * 0.06, duration: 0.3 }}
                          className="space-y-2.5"
                        >
                          <label className="text-sm font-medium block" style={{ color: fieldErrors[field.id] ? dark.error : dark.textSecondary }}>
                            {getFieldLabel(field)}
                            {field.is_required && <span className="ml-1" style={{ color: dark.accent }}>*</span>}
                          </label>
                          {renderField(field)}
                          <AnimatePresence>
                            {fieldErrors[field.id] && (
                              <motion.p
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="text-xs"
                                style={{ color: dark.error }}
                              >
                                Campo obrigatório
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      ))}
                    </>
                  )}

                  {/* Field Steps */}
                  {currentStepData?.type === "fields" && currentStepData.fields.filter(f => !isSpouseField(f) || isSpouseFieldVisible).map((field, index) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06, duration: 0.3 }}
                      className="space-y-2.5"
                    >
                      <label className="text-sm font-medium block" style={{ color: fieldErrors[field.id] ? dark.error : dark.textSecondary }}>
                        {getFieldLabel(field)}
                        {field.is_required && <span className="ml-1" style={{ color: dark.accent }}>*</span>}
                      </label>
                      {renderField(field)}
                      <AnimatePresence>
                        {fieldErrors[field.id] && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-xs"
                            style={{ color: dark.error }}
                          >
                            Campo obrigatório
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div
              className="px-6 sm:px-8 py-5 flex items-center gap-3 border-t"
              style={{
                borderColor: dark.border,
                backgroundColor: "rgba(255,255,255,0.01)",
              }}
            >
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="h-11 px-5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 border hover:bg-[rgba(255,255,255,0.03)]"
                  style={{ borderColor: dark.border, color: dark.textSecondary }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </button>
              )}

              <div className="flex-1" />

              {isLastStep || isSingleStep ? (
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-11 px-7 rounded-lg text-sm font-semibold flex items-center gap-2.5 transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                  style={{ backgroundColor: dark.accent, color: dark.bg }}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Enviar
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="h-11 px-7 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                  style={{ backgroundColor: dark.accent, color: dark.bg }}
                >
                  Continuar
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        {appearance.show_footer !== false && appearance.footer_text && (
          <div className="text-center mt-8 text-xs tracking-wide" style={{ color: dark.textTertiary }}>
            {appearance.footer_text}
          </div>
        )}
      </motion.div>
    </div>
  );
}
