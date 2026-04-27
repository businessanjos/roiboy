import React, { useState, useEffect, useMemo } from "react";
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
  ChevronRight, ChevronLeft, ArrowRight, Plus, X, Baby, MapPin, Search,
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
  "filho", "filhos",
];

const PERSONAL_FIELD_PATTERNS = [
  /nascimento/,
  /profissao/,
  /instagram/,
  /estado civil/,
  /conjuge/,
  /casamento/,
  /emergencia/,
  /documento/,
  /(^|[^a-z])(endereco|cep|cpf|rg|filho|filhos)([^a-z]|$)/,
];

const PHONE_FIELD_PATTERNS = [
  /telefone/,
  /celular/,
  /whatsapp/,
  /phone/,
  /(^|[^a-z])tel([^a-z]|$)/,
];

function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isPersonalField(field: CustomField): boolean {
  const normalized = normalizeFieldName(field.name);
  return PERSONAL_FIELD_PATTERNS.some((pattern) => pattern.test(normalized));
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

function CivilStatusDropdown({ value, hasError, dark, onSelect }: {
  value: string;
  hasError: boolean;
  dark: Record<string, string>;
  onSelect: (opt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
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
              onSelect(opt);
              setOpen(false);
            }}
          >
            {opt}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function isSpouseField(field: CustomField): boolean {
  const lower = field.name.toLowerCase();
  return ["cônjuge", "conjuge", "aniversário de casamento", "aniversario de casamento"].some((kw) => lower.includes(kw));
}

function isVirtualSpouseField(field: CustomField): boolean {
  return field.id.includes("__nome") || field.id.includes("__profissao");
}

type ComplexFieldKind = "address" | "children" | "employee" | null;

function getComplexFieldKind(field: CustomField): ComplexFieldKind {
  const normalized = normalizeFieldName(field.name);

  if (
    /(colaborador|colaboradores|funcionario|funcionarios|equipe)/.test(normalized) &&
    /(funcao|funcoes|categoria|categorias)/.test(normalized)
  ) {
    return "employee";
  }

  if (/(^|[^a-z])(filho|filhos|children)([^a-z]|$)/.test(normalized)) {
    return "children";
  }

  if (/(^|[^a-z])(endereco|cep)([^a-z]|$)/.test(normalized)) {
    return "address";
  }

  return null;
}

function isChildrenField(field: CustomField): boolean {
  return getComplexFieldKind(field) === "children";
}

function isAddressField(field: CustomField): boolean {
  return getComplexFieldKind(field) === "address";
}

function isPercentageField(field: CustomField): boolean {
  const lower = field.name.toLowerCase();
  return ["margem", "percentual", "porcentagem", "%"].some((kw) => lower.includes(kw));
}

function isSocialMediaStatusField(field: CustomField): boolean {
  const lower = field.name.toLowerCase();
  return lower.includes("instagram") && lower.includes("redes sociais");
}

function isEmployeeField(field: CustomField): boolean {
  return getComplexFieldKind(field) === "employee";
}

const SOCIAL_MEDIA_OPTIONS = [
  "Tenho apenas um perfil pessoal/profissional, me apresento com meu nome, mantenho uma rotina de postagens e comunico os benefícios do que ofereço.",
  "Tenho dois perfis, sendo um profissional e outro pessoal.",
  "Não utilizo ou utilizo raramente, ou não vejo benefício.",
];

const HIRING_REGIME_OPTIONS = ["CLT", "PJ", "RPA"];

interface EmployeeEntry {
  cargo: string;
  regime: string;
}

function isPhoneField(field: CustomField): boolean {
  if (field.field_type === "phone") return true;
  const normalized = normalizeFieldName(field.name);
  return PHONE_FIELD_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isPrimaryClientPhoneField(field: CustomField): boolean {
  const normalized = normalizeFieldName(field.name);

  if (!isPhoneField(field) || normalized.includes("emergencia")) {
    return false;
  }

  return [
    "numero do seu telefone",
    "seu telefone",
    "telefone principal",
    "telefone com codigo do pais",
  ].some((keyword) => normalized.includes(keyword));
}

const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  "emergência": "Contato de emergência",
  "emergencia": "Contato de emergência",
  "filho": "Tem filhos?",
  "endereço": "Endereço",
  "endereco": "Endereço",
  "formalizada": "Formalização",
};

function getFieldLabel(field: CustomField): string {
  const lower = field.name.toLowerCase();
  for (const [keyword, label] of Object.entries(FIELD_LABEL_OVERRIDES)) {
    if (lower.includes(keyword)) return label;
  }
  return field.name;
}

function isSpouseNameProfessionField(field: CustomField): boolean {
  const lower = field.name.toLowerCase();
  return (["cônjuge", "conjuge"].some((kw) => lower.includes(kw)) &&
    !lower.includes("aniversário") && !lower.includes("aniversario") && !lower.includes("casamento"));
}

function isTrademarkField(field: CustomField): boolean {
  const normalized = normalizeFieldName(field.name);
  return normalized.includes("marca registrada");
}

function isVirtualTrademarkField(field: CustomField): boolean {
  return field.id.includes("__marca_");
}

const GRADUATION_SUGGESTIONS = ["Biomedicina", "Medicina", "Fisioterapia", "Odontologia"];

function isGraduationField(field: CustomField): boolean {
  const normalized = normalizeFieldName(field.name);
  return normalized.includes("graduacao") || normalized.includes("formacao de graduacao");
}

function isVirtualGraduationField(field: CustomField): boolean {
  return field.id.includes("__grad_especializacao");
}

function splitSpouseFields(fields: CustomField[]): CustomField[] {
  const result: CustomField[] = [];
  for (const field of fields) {
    if (isSpouseNameProfessionField(field)) {
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
    } else if (isTrademarkField(field)) {
      result.push({
        ...field,
        id: `${field.id}__marca_possui`,
        name: "Possui marca registrada?",
        field_type: "boolean",
        is_required: field.is_required,
      });
      result.push({
        ...field,
        id: `${field.id}__marca_nome`,
        name: "Qual é o nome da marca?",
        field_type: "text",
        is_required: false,
      });
      result.push({
        ...field,
        id: `${field.id}__marca_como`,
        name: "Como esse nome foi definido?",
        field_type: "text",
        is_required: false,
      });
    } else if (isGraduationField(field)) {
      result.push(field);
      result.push({
        ...field,
        id: `${field.id}__grad_especializacao`,
        name: "Qual sua especialização na Medicina?",
        field_type: "text",
        is_required: false,
      });
    } else {
      result.push(field);
    }
  }
  return result;
}

function dedupeFieldsById(fields: CustomField[]): CustomField[] {
  const seen = new Set<string>();
  return fields.filter((field) => {
    if (seen.has(field.id)) return false;
    seen.add(field.id);
    return true;
  });
}

function getComplexFieldTitle(field: CustomField): string {
  switch (getComplexFieldKind(field)) {
    case "address":
      return "Endereço";
    case "children":
      return "Filhos";
    case "employee":
      return "Equipe";
    default:
      return "Etapa";
  }
}

function buildSteps(
  customFields: CustomField[],
  requireClientInfo: boolean,
  hasClientId: boolean
): FieldStep[] {
  const steps: FieldStep[] = [];
  const assignedFieldIds = new Set<string>();

  const claimFields = (fields: CustomField[]) => {
    const available = fields.filter((field) => !assignedFieldIds.has(field.id));
    available.forEach((field) => assignedFieldIds.add(field.id));
    return available;
  };

  const uniqueFields = dedupeFieldsById(splitSpouseFields(customFields)).filter(
    (field) => !(requireClientInfo && !hasClientId && isPrimaryClientPhoneField(field))
  );
  const basicPersonalFields = uniqueFields.filter(
    (field) => isPersonalField(field) && !getComplexFieldKind(field)
  );

  if (requireClientInfo && !hasClientId) {
    steps.push({
      title: "Dados Pessoais",
      fields: claimFields(basicPersonalFields),
      type: "client_info",
    });
  } else {
    const fields = claimFields(basicPersonalFields);
    if (fields.length > 0) {
      steps.push({ title: "Dados Pessoais", fields, type: "fields" });
    }
  }

  let stepIndex = steps.length + 1;
  const createdComplexKinds = new Set<Exclude<ComplexFieldKind, null>>();

  const MAX_PER_STEP = 3;
  let currentBatch: CustomField[] = [];

  const flushBatch = () => {
    const fields = claimFields(currentBatch);
    if (fields.length > 0) {
      steps.push({
        title: `Etapa ${stepIndex}`,
        fields,
        type: "fields",
      });
      stepIndex++;
    }
    currentBatch = [];
  };

  for (const field of uniqueFields) {
    if (assignedFieldIds.has(field.id)) continue;

    const complexKind = getComplexFieldKind(field);

    if (complexKind && !createdComplexKinds.has(complexKind)) {
      flushBatch();
      const fields = claimFields([field]);
      if (fields.length === 0) continue;

      steps.push({
        title: getComplexFieldTitle(field),
        fields,
        type: "fields",
      });
      createdComplexKinds.add(complexKind);
      stepIndex++;
      continue;
    }

    // Keep trademark and graduation virtual fields grouped with their parent
    if (isVirtualTrademarkField(field) || isVirtualGraduationField(field)) {
      // Add to current batch without triggering flush
      currentBatch.push(field);
      continue;
    }

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
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [gradHighlightIdx, setGradHighlightIdx] = useState(-1);

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

function isProfessionalYearsField(field: CustomField): boolean {
  const normalized = normalizeFieldName(field.name);
  return normalized.includes("quanto tempo") && normalized.includes("area profissional");
}

function isYesNoTextField(field: CustomField): boolean {
  const normalized = normalizeFieldName(field.name);
  return normalized.includes("vende cursos tecnicos") || normalized.includes("metodo proprio");
}

function isMetodoProprio(field: CustomField): boolean {
  const normalized = normalizeFieldName(field.name);
  return normalized.includes("metodo proprio");
}

// isProdutosServicosField removed – "formalizada" field renders as normal text

  const isSpouseFieldVisible = useMemo(() => {
    const civilStatusField = customFields.find(isCivilStatusField);
    if (!civilStatusField) return true;
    const civilValue = responses[civilStatusField.id];
    return CIVIL_STATUS_WITH_SPOUSE.includes(civilValue);
  }, [customFields, responses]);

  const isTrademarkSubFieldVisible = (field: CustomField): boolean => {
    if (!isVirtualTrademarkField(field)) return true;
    if (field.id.endsWith("__marca_possui")) return true;
    // Find the parent possui field
    const parentId = field.id.replace(/__marca_(nome|como)$/, "__marca_possui");
    const possuiValue = responses[parentId];
    return possuiValue === true || possuiValue === "Sim";
  };

  const isGraduationSpecVisible = (field: CustomField): boolean => {
    if (!isVirtualGraduationField(field)) return true;
    const parentId = field.id.replace(/__grad_especializacao$/, "");
    const gradValue = (responses[parentId] || "").toString().toLowerCase().trim();
    return gradValue === "medicina";
  };

  const totalSteps = steps.length;
  const isLastStep = currentStep === totalSteps - 1;
  const isSingleStep = totalSteps <= 1;
  const appearance = { ...DEFAULT_APPEARANCE, ...formData?.appearance };
  const currentStepData = steps[currentStep];
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 100;
  const visibleCurrentFields = currentStepData?.fields.filter((field) => {
    if (isVirtualSpouseField(field) && !isSpouseFieldVisible) return false;
    if (!isTrademarkSubFieldVisible(field)) return false;
    if (!isGraduationSpecVisible(field)) return false;
    return true;
  }) ?? [];

  /* ─── Validation ────────────────────────────────────────────── */

  const isFieldEmpty = (field: CustomField, value: any): boolean => {
    if (value === undefined || value === null) return true;
    if (typeof value === "string" && !value.trim()) return true;
    switch (field.field_type) {
      case "boolean": return value !== true && value !== false;
      case "multi_select":
      case "multiple_choice":
      case "user":
      case "multi_instagram":
        // Some multi_select fields have custom single-choice rendering that stores a string
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === "string") return !value.trim();
        return true;
      case "location":
        // Location can be array or object
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === "object") return Object.keys(value).length === 0;
        if (typeof value === "string") return !value.trim();
        return true;
      case "number":
      case "currency": return value === "" || isNaN(value);
      case "select":
      case "single_choice":
        if (typeof value === "string") return !value.trim();
        if (Array.isArray(value)) return value.length === 0;
        return !value;
      default:
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === "object") return Object.keys(value).length === 0;
        return !value;
    }
  };

  const validateField = (field: CustomField, errors: Record<string, boolean>) => {
    if (!field.is_required) return;

    if (isMetodoProprio(field)) {
      if (!responses[field.id]) {
        errors[field.id] = true;
        return;
      }

      if (responses[field.id] === "Sim" && !((responses[`${field.id}__metodo_nome`] as string) ?? "").trim()) {
        errors[field.id] = true;
      }

      return;
    }

    if (isFieldEmpty(field, responses[field.id])) {
      errors[field.id] = true;
    }
  };

  const validateCurrentStep = (): boolean => {
    const step = steps[currentStep];
    if (!step) return true;
    const errors: Record<string, boolean> = {};

    if (step.type === "client_info") {
      if (!clientName.trim()) errors.clientName = true;
      if (!clientPhone.trim()) errors.clientPhone = true;
    }

    visibleCurrentFields.forEach((field) => validateField(field, errors));

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
      // Merge split spouse fields back into original field
      const mergedResponses = { ...responses };
      const spouseOriginalIds = new Set<string>();
      for (const key of Object.keys(mergedResponses)) {
        if (key.includes("__nome") || key.includes("__profissao")) {
          const originalId = key.replace(/__nome$/, "").replace(/__profissao$/, "");
          spouseOriginalIds.add(originalId);
        }
      }
      for (const originalId of spouseOriginalIds) {
        const nome = mergedResponses[`${originalId}__nome`] || "";
        const profissao = mergedResponses[`${originalId}__profissao`] || "";
        const parts = [nome, profissao].filter(Boolean);
        mergedResponses[originalId] = parts.join(" — ");
        delete mergedResponses[`${originalId}__nome`];
        delete mergedResponses[`${originalId}__profissao`];
      }

      // Merge split trademark fields back into original field
      const trademarkOriginalIds = new Set<string>();
      for (const key of Object.keys(mergedResponses)) {
        if (key.includes("__marca_")) {
          const originalId = key.replace(/__marca_(possui|nome|como)$/, "");
          trademarkOriginalIds.add(originalId);
        }
      }
      for (const originalId of trademarkOriginalIds) {
        const possui = mergedResponses[`${originalId}__marca_possui`];
        if (possui === true || possui === "Sim") {
          const nome = mergedResponses[`${originalId}__marca_nome`] || "";
          const como = mergedResponses[`${originalId}__marca_como`] || "";
          const parts = ["Sim", nome && `Nome: ${nome}`, como && `Definição: ${como}`].filter(Boolean);
          mergedResponses[originalId] = parts.join(" — ");
        } else {
          mergedResponses[originalId] = "Não";
        }
        delete mergedResponses[`${originalId}__marca_possui`];
        delete mergedResponses[`${originalId}__marca_nome`];
        delete mergedResponses[`${originalId}__marca_como`];
      }

      // Merge graduation specialization fields back
      const gradOriginalIds = new Set<string>();
      for (const key of Object.keys(mergedResponses)) {
        if (key.includes("__grad_especializacao")) {
          const originalId = key.replace(/__grad_especializacao$/, "");
          gradOriginalIds.add(originalId);
        }
      }
      for (const originalId of gradOriginalIds) {
        const espec = mergedResponses[`${originalId}__grad_especializacao`] || "";
        const gradValue = (mergedResponses[originalId] || "").toString();
        if (gradValue.toLowerCase().trim() === "medicina" && espec) {
          mergedResponses[originalId] = `${gradValue} — Especialização: ${espec}`;
        }
        delete mergedResponses[`${originalId}__grad_especializacao`];
      }

      // Merge método próprio sub-field
      const metodoIds = new Set<string>();
      for (const key of Object.keys(mergedResponses)) {
        if (key.includes("__metodo_nome")) {
          metodoIds.add(key.replace(/__metodo_nome$/, ""));
        }
      }
      for (const originalId of metodoIds) {
        const mainVal = mergedResponses[originalId];
        const nomeMetodo = mergedResponses[`${originalId}__metodo_nome`] || "";
        if (mainVal === "Sim" && nomeMetodo) {
          mergedResponses[originalId] = `Sim — Método: ${nomeMetodo}`;
        }
        delete mergedResponses[`${originalId}__metodo_nome`];
      }

      // (Produtos/Serviços merge removed – field is normal text now)

      for (const [key, val] of Object.entries(mergedResponses)) {
        if (Array.isArray(val) && val.length > 0 && val[0]?.nome !== undefined) {
          mergedResponses[key] = val
            .filter((c: any) => c.nome)
            .map((c: any, i: number) => {
              const parts = [c.nome];
              if (c.nascimento) {
                const [y, m, d] = c.nascimento.split("-").map(Number);
                parts.push(format(new Date(y, m - 1, d), "dd/MM/yyyy"));
              }
              return `${i + 1}. ${parts.join(" — ")}`;
            })
            .join("; ");
        }
      }

      // Serialize address fields to readable string
      for (const [key, val] of Object.entries(mergedResponses)) {
        if (typeof val === "object" && val !== null && "cep" in val && "rua" in val) {
          const a = val as any;
          const parts = [
            a.rua && a.numero ? `${a.rua}, ${a.numero}` : a.rua,
            a.complemento,
            a.bairro,
            a.cidade && a.estado ? `${a.cidade} - ${a.estado}` : a.cidade,
            a.cep,
          ].filter(Boolean);
          mergedResponses[key] = parts.join(", ");
        }
      }

      const payload = {
        formId,
        clientId: clientData?.id || null,
        clientName: clientName.trim() || null,
        clientPhone: clientPhone.trim() || null,
        responses: mergedResponses,
      };

      console.info("[PublicForm] Submitting form response", {
        formId,
        clientId: payload.clientId,
        clientName: payload.clientName,
        clientPhone: payload.clientPhone,
        responseCount: Object.keys(mergedResponses).length,
        responseKeys: Object.keys(mergedResponses),
      });

      const { data, error } = await supabase.functions.invoke("submit-form-response", {
        body: payload,
      });

      if (error) {
        // FunctionsHttpError exposes the response so we can read the server message
        let serverMessage: string | null = null;
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            serverMessage = body?.error || body?.message || null;
            console.error("[PublicForm] Edge function error body:", body);
          } else if (ctx && typeof ctx.text === "function") {
            const text = await ctx.text();
            serverMessage = text || null;
            console.error("[PublicForm] Edge function error text:", text);
          }
        } catch (parseErr) {
          console.error("[PublicForm] Failed to parse edge function error body:", parseErr);
        }
        console.error("[PublicForm] Edge function invoke error:", {
          name: (error as any)?.name,
          message: (error as any)?.message,
          status: (error as any)?.context?.status,
          serverMessage,
        });
        throw new Error(serverMessage || (error as any)?.message || "Falha de comunicação com o servidor");
      }

      if (data?.error) {
        console.error("[PublicForm] Server returned error in payload:", data);
        throw new Error(data.error);
      }

      console.info("[PublicForm] Submission saved", data);
      setSubmitted(true);
    } catch (err: any) {
      const detail =
        err?.message ||
        (typeof err === "string" ? err : null) ||
        "Erro desconhecido ao enviar a resposta.";
      console.error("[PublicForm] Error submitting form:", {
        message: detail,
        error: err,
        stack: err?.stack,
      });
      setError(detail);
      toast.error("Não foi possível enviar o formulário", {
        description: detail,
        duration: 8000,
      });
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

    // Graduation field with autocomplete suggestions
    if (isGraduationField(field) && !isVirtualGraduationField(field)) {
      const typed = (value || "").toString();
      const typedLower = typed.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const GRADUATION_ALIASES: Record<string, string[]> = {
        "Medicina": ["medicina", "medico", "medica"],
      };
      const filtered = typed.length > 0
        ? GRADUATION_SUGGESTIONS.filter(s => {
            if (s.toLowerCase() === typedLower) return false;
            const aliases = GRADUATION_ALIASES[s] || [];
            return s.toLowerCase().startsWith(typedLower) || aliases.some(a => a.startsWith(typedLower));
          })
        : [];

      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (filtered.length === 0) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setGradHighlightIdx(prev => (prev + 1) % filtered.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setGradHighlightIdx(prev => (prev <= 0 ? filtered.length - 1 : prev - 1));
        } else if (e.key === "Enter" && gradHighlightIdx >= 0 && gradHighlightIdx < filtered.length) {
          e.preventDefault();
          updateResponse(field.id, filtered[gradHighlightIdx]);
          setGradHighlightIdx(-1);
        }
      };

      return (
        <div className="relative">
          <input
            type="text"
            value={typed}
            onChange={(e) => { updateResponse(field.id, e.target.value); setGradHighlightIdx(-1); }}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Medicina, Odontologia..."
            className={baseInputClass}
            style={inputStyles}
          />
          <AnimatePresence>
            {filtered.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute z-20 left-0 right-0 mt-1 rounded-lg border overflow-hidden shadow-2xl shadow-black/40"
                style={{ backgroundColor: dark.surface, borderColor: dark.border }}
              >
                {filtered.map((suggestion, idx) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="w-full text-left px-4 py-3 text-[15px] transition-colors hover:bg-white/5"
                    style={{
                      color: dark.text,
                      backgroundColor: idx === gradHighlightIdx ? "rgba(255,255,255,0.08)" : "transparent",
                    }}
                    onClick={() => { updateResponse(field.id, suggestion); setGradHighlightIdx(-1); }}
                  >
                    <span style={{ color: dark.accent }}>{suggestion.slice(0, typed.length)}</span>
                    {suggestion.slice(typed.length)}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    // Children dynamic field (must be checked BEFORE date detection)
    if (isChildrenField(field)) {
      const children: { nome: string; nascimento: string }[] = Array.isArray(value) ? value : [];

      const addChild = () => {
        updateResponse(field.id, [...children, { nome: "", nascimento: "" }]);
      };

      const removeChild = (index: number) => {
        updateResponse(field.id, children.filter((_, i) => i !== index));
      };

      const updateChild = (index: number, key: "nome" | "nascimento", val: string) => {
        const updated = children.map((c, i) => (i === index ? { ...c, [key]: val } : c));
        updateResponse(field.id, updated);
      };

      return (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {children.map((child, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl border p-4 space-y-3"
                style={{ backgroundColor: dark.surface, borderColor: dark.border }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: dark.textTertiary }}>
                    Filho {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeChild(index)}
                    className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-white/10"
                    style={{ color: dark.textTertiary }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={child.nome}
                    onChange={(e) => updateChild(index, "nome", e.target.value)}
                    placeholder="Nome do filho(a)"
                    className={cn(
                      "w-full h-11 rounded-lg border bg-transparent px-4 text-[15px] outline-none transition-all duration-200",
                      "placeholder:text-[rgba(240,240,242,0.25)] focus:ring-2"
                    )}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.03)",
                      color: dark.text,
                      borderColor: dark.border,
                      // @ts-ignore
                      "--tw-ring-color": dark.accent,
                    }}
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "w-full h-11 rounded-lg border flex items-center gap-3 px-4 text-[15px] outline-none transition-all duration-200",
                          "hover:border-[rgba(255,255,255,0.12)]"
                        )}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.03)",
                          color: dark.text,
                          borderColor: child.nascimento ? dark.borderActive : dark.border,
                        }}
                      >
                        <CalendarIcon className="h-4 w-4 shrink-0" style={{ color: child.nascimento ? dark.accent : dark.textTertiary }} />
                        <span style={{ color: child.nascimento ? dark.text : dark.textTertiary }}>
                          {child.nascimento
                            ? (() => {
                                const [y, m, d] = child.nascimento.split("-").map(Number);
                                return format(new Date(y, m - 1, d), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
                              })()
                            : "Data de nascimento"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 border-0 shadow-2xl shadow-black/40 pointer-events-auto"
                      align="start"
                      style={{ backgroundColor: "rgb(24,24,27)" }}
                    >
                      <ScrollDatePicker
                        value={child.nascimento ? (() => { const [y, m, d] = child.nascimento.split("-").map(Number); return new Date(y, m - 1, d); })() : undefined}
                        onChange={(date) => updateChild(index, "nascimento", format(date, "yyyy-MM-dd"))}
                        maxYear={new Date().getFullYear()}
                        minYear={1950}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <button
            type="button"
            onClick={addChild}
            className="w-full h-12 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 text-[14px] font-medium transition-all duration-200 hover:border-opacity-60"
            style={{
              borderColor: `${dark.accent}40`,
              color: dark.accent,
              backgroundColor: dark.accentSubtle,
            }}
          >
            <Plus className="h-4 w-4" />
            Adicionar Filho
          </button>
        </div>
      );
    }

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
        <CivilStatusDropdown
          value={value}
          hasError={hasError}
          dark={dark}
          onSelect={(opt) => updateResponse(field.id, opt)}
        />
      );
    }

    // Address with CEP auto-fill
    if (isAddressField(field)) {
      const addr = (typeof value === "object" && value !== null) ? value : { cep: "", rua: "", bairro: "", cidade: "", estado: "", numero: "", complemento: "" };

      const updateAddr = (key: string, val: string) => {
        const updated = { ...addr, [key]: val };
        updateResponse(field.id, updated);
      };

      const formatCep = (raw: string) => {
        const digits = raw.replace(/\D/g, "").slice(0, 8);
        if (digits.length <= 5) return digits;
        return `${digits.slice(0, 5)}-${digits.slice(5)}`;
      };

      const fetchCep = async (cep: string) => {
        const digits = cep.replace(/\D/g, "");
        if (digits.length !== 8) return;
        setCepLoading(true);
        setCepError("");
        try {
          const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
          const data = await res.json();
          if (data.erro) {
            setCepError("CEP não encontrado");
            return;
          }
          const updated = {
            ...addr,
            cep: formatCep(digits),
            rua: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            estado: data.uf || "",
          };
          updateResponse(field.id, updated);
        } catch {
          setCepError("Erro ao buscar CEP");
        } finally {
          setCepLoading(false);
        }
      };

      const addrInputClass = cn(
        "w-full h-11 rounded-lg border bg-transparent px-4 text-[15px] outline-none transition-all duration-200",
        "placeholder:text-[rgba(240,240,242,0.25)] focus:ring-2"
      );
      const addrInputStyle: React.CSSProperties = {
        backgroundColor: "rgba(255,255,255,0.03)",
        color: dark.text,
        borderColor: dark.border,
        // @ts-ignore
        "--tw-ring-color": dark.accent,
      };

      return (
        <div className="space-y-3">
          {/* CEP */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: dark.textTertiary }}>CEP</label>
            <div className="relative">
              <input
                type="text"
                value={addr.cep || ""}
                onChange={(e) => {
                  const formatted = formatCep(e.target.value);
                  updateAddr("cep", formatted);
                  const digits = formatted.replace(/\D/g, "");
                  if (digits.length === 8) fetchCep(digits);
                }}
                placeholder="00000-000"
                className={cn(addrInputClass, "pr-10")}
                style={addrInputStyle}
                inputMode="numeric"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {cepLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: dark.accent }} />
                ) : (
                  <MapPin className="h-4 w-4" style={{ color: dark.textTertiary }} />
                )}
              </div>
            </div>
            <AnimatePresence>
              {cepError && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs"
                  style={{ color: dark.error }}
                >
                  {cepError}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Rua */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: dark.textTertiary }}>Rua</label>
            <input
              type="text"
              value={addr.rua || ""}
              onChange={(e) => updateAddr("rua", e.target.value)}
              placeholder="Logradouro"
              className={addrInputClass}
              style={addrInputStyle}
            />
          </div>

          {/* Número + Complemento */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: dark.textTertiary }}>Número</label>
              <input
                type="text"
                value={addr.numero || ""}
                onChange={(e) => updateAddr("numero", e.target.value)}
                placeholder="Nº"
                className={addrInputClass}
                style={addrInputStyle}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: dark.textTertiary }}>Complemento</label>
              <input
                type="text"
                value={addr.complemento || ""}
                onChange={(e) => updateAddr("complemento", e.target.value)}
                placeholder="Apto, bloco..."
                className={addrInputClass}
                style={addrInputStyle}
              />
            </div>
          </div>

          {/* Bairro */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium" style={{ color: dark.textTertiary }}>Bairro</label>
            <input
              type="text"
              value={addr.bairro || ""}
              onChange={(e) => updateAddr("bairro", e.target.value)}
              placeholder="Bairro"
              className={addrInputClass}
              style={addrInputStyle}
            />
          </div>

          {/* Cidade + Estado */}
          <div className="grid grid-cols-[1fr,80px] gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: dark.textTertiary }}>Cidade</label>
              <input
                type="text"
                value={addr.cidade || ""}
                onChange={(e) => updateAddr("cidade", e.target.value)}
                placeholder="Cidade"
                className={addrInputClass}
                style={addrInputStyle}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: dark.textTertiary }}>UF</label>
              <input
                type="text"
                value={addr.estado || ""}
                onChange={(e) => updateAddr("estado", e.target.value.toUpperCase().slice(0, 2))}
                placeholder="UF"
                className={addrInputClass}
                style={addrInputStyle}
                maxLength={2}
              />
            </div>
          </div>
        </div>
      );
    }

    // Instagram detection (skip if it's the social media status question)
    if (field.name.toLowerCase().includes("instagram") && !isSocialMediaStatusField(field)) {
      const INSTAGRAM_PREFIX = "https://instagram.com/";
      const rawVal = (value as string) || "";
      const username = rawVal.startsWith(INSTAGRAM_PREFIX)
        ? rawVal.slice(INSTAGRAM_PREFIX.length)
        : rawVal.replace(/^@/, "");
      return (
        <div className="relative flex items-center">
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 text-sm select-none pointer-events-none whitespace-nowrap"
            style={{ color: dark.textTertiary }}
          >
            {INSTAGRAM_PREFIX}
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/^@/, "").replace(/\s/g, "");
              updateResponse(field.id, cleaned ? INSTAGRAM_PREFIX + cleaned : "");
            }}
            placeholder="seuusuario"
            className={baseInputClass}
            style={{ ...inputStyles, paddingLeft: "210px" }}
          />
        </div>
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

    // Social media status field — forced multiple choice
    if (isSocialMediaStatusField(field)) {
      return (
        <div className="space-y-3">
          {SOCIAL_MEDIA_OPTIONS.map((option, idx) => {
            const selected = value === option;
            return (
              <button
                key={idx}
                type="button"
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all duration-200 text-sm leading-relaxed",
                  selected
                    ? "border-white/40 bg-white/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                )}
                style={{ color: dark.text }}
                onClick={() => updateResponse(field.id, selected ? "" : option)}
              >
                <span className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      selected ? "border-white bg-white" : "border-white/30"
                    )}
                  >
                    {selected && <span className="w-2 h-2 rounded-full bg-[#0a0a0b]" />}
                  </span>
                  {option}
                </span>
              </button>
            );
          })}
        </div>
      );
    }
    // Employee/team field — Yes/No with dynamic rows
    if (isEmployeeField(field)) {
      let employees: EmployeeEntry[] = [];
      let hasEmployees = false;
      try {
        const parsed = JSON.parse((value as string) || "null");
        if (parsed && typeof parsed === "object" && "hasEmployees" in parsed) {
          hasEmployees = parsed.hasEmployees;
          employees = parsed.employees || [];
        }
      } catch { /* ignore */ }

      const updateEmployeeData = (has: boolean, emps: EmployeeEntry[]) => {
        updateResponse(field.id, JSON.stringify({ hasEmployees: has, employees: emps }));
      };

      const addEmployee = () => {
        updateEmployeeData(true, [...employees, { cargo: "", regime: "" }]);
      };

      const removeEmployee = (idx: number) => {
        const updated = employees.filter((_, i) => i !== idx);
        updateEmployeeData(true, updated);
      };

      const updateEmployee = (idx: number, key: keyof EmployeeEntry, val: string) => {
        const updated = [...employees];
        updated[idx] = { ...updated[idx], [key]: val };
        updateEmployeeData(true, updated);
      };

      return (
        <div className="space-y-4">
          {/* Yes / No toggle */}
          <div className="flex gap-3">
            {[
              { label: "Sim", val: true },
              { label: "Não", val: false },
            ].map(({ label, val }) => {
              const selected = value !== undefined && value !== "" && hasEmployees === val;
              return (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    "flex-1 h-12 rounded-xl border text-sm font-medium transition-all duration-200",
                    selected
                      ? "border-white/40 bg-white/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                  )}
                  style={{ color: dark.text }}
                  onClick={() => {
                    if (val) {
                      const emps = employees.length > 0 ? employees : [{ cargo: "", regime: "" }];
                      updateEmployeeData(true, emps);
                    } else {
                      updateEmployeeData(false, []);
                    }
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Employee rows (only when "Sim") */}
          {hasEmployees && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              {employees.map((emp, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Cargo / Função"
                    value={emp.cargo}
                    onChange={(e) => updateEmployee(idx, "cargo", e.target.value)}
                    className={cn(baseInputClass, "flex-1")}
                    style={inputStyles}
                  />
                  <div className="flex gap-1.5 flex-shrink-0">
                    {HIRING_REGIME_OPTIONS.map((regime) => (
                      <button
                        key={regime}
                        type="button"
                        className={cn(
                          "h-11 px-3 rounded-lg border text-xs font-medium transition-all duration-200",
                          emp.regime === regime
                            ? "border-white/40 bg-white/10"
                            : "border-white/10 bg-white/[0.03] hover:border-white/20"
                        )}
                        style={{ color: dark.text }}
                        onClick={() => updateEmployee(idx, "regime", regime)}
                      >
                        {regime}
                      </button>
                    ))}
                  </div>
                  {employees.length > 1 && (
                    <button
                      type="button"
                      className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                      style={{ color: dark.textTertiary }}
                      onClick={() => removeEmployee(idx)}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: dark.accent }}
                onClick={addEmployee}
              >
                <Plus size={16} />
                Adicionar colaborador
              </button>
            </motion.div>
          )}
        </div>
      );
    }


    if (isPercentageField(field)) {
      return (
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            value={value ?? ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              if (raw === "") { updateResponse(field.id, ""); return; }
              const num = Math.min(Number(raw), 99);
              updateResponse(field.id, String(num));
            }}
            placeholder="Ex: 30"
            className={baseInputClass}
            style={inputStyles}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: dark.textTertiary }}>%</span>
        </div>
      );
    }

    if (isProfessionalYearsField(field)) {
      return (
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={value ?? ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              if (raw === "") { updateResponse(field.id, ""); return; }
              const num = Math.min(Math.max(Number(raw), 1), 60);
              updateResponse(field.id, String(num));
            }}
            placeholder="Ex: 10"
            className={baseInputClass}
            style={{ ...inputStyles, paddingRight: "60px" }}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: dark.textTertiary }}>anos</span>
        </div>
      );
    }

    if (isYesNoTextField(field)) {
      return (
        <>
        <div className="grid grid-cols-2 gap-3">
          {[{ label: "Sim", val: "Sim" }, { label: "Não", val: "Não" }].map(({ label, val }) => {
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
        {isMetodoProprio(field) && value === "Sim" && (
          <div className="space-y-2 mt-4">
            <label className="block text-[15px] font-medium" style={{ color: dark.text }}>
              Qual o nome do método? <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              value={responses[`${field.id}__metodo_nome`] ?? ""}
              onChange={(e) => updateResponse(`${field.id}__metodo_nome`, e.target.value)}
              placeholder="Nome do método..."
              className={baseInputClass}
              style={inputStyles}
            />
          </div>
        )}
        </>
      );
    }

    // "formalizada" field now renders as normal text field via switch below

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
                      {visibleCurrentFields.map((field, index) => (
                        <motion.div
                          key={field.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: (index + 2) * 0.06, duration: 0.3 }}
                          className="space-y-2.5"
                        >
                          <label className="text-sm font-medium block" style={{ color: fieldErrors[field.id] ? dark.error : dark.textSecondary }}>
                            {getFieldLabel(field)}
                            {field.is_required && !isChildrenField(field) && <span className="ml-1" style={{ color: dark.accent }}>*</span>}
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
                  {currentStepData?.type === "fields" && visibleCurrentFields.map((field, index) => (
                    <motion.div
                      key={field.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06, duration: 0.3 }}
                      className="space-y-2.5"
                    >
                      <label className="text-sm font-medium block" style={{ color: fieldErrors[field.id] ? dark.error : dark.textSecondary }}>
                        {getFieldLabel(field)}
                        {field.is_required && !isChildrenField(field) && <span className="ml-1" style={{ color: dark.accent }}>*</span>}
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
