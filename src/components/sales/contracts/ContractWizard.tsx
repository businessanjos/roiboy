import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  FileText,
  User,
  Building2,
  CreditCard,
  Calendar,
  Sparkles,
  Search,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Eye,
  RotateCw,
  AlertCircle,
  Settings2,
  Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  buildPlaceholderValues,
  type AutofillContext,
  type TemplateVariableDef,
} from "@/lib/contractTemplates";
import { numberToBRLExtenso } from "@/lib/numberToWordsBRL";
import { TemplatedContractPreview } from "./TemplatedContractSection";

/* ================================================================== */
/* Public types                                                        */
/* ================================================================== */

export interface ContractWizardProps {
  templateId: string | null;
  productId: string | null;
  templateHtml: string | null;
  templateVariables: TemplateVariableDef[];
  placeholderValues: Record<string, any>;
  onChange: (next: {
    template_id: string | null;
    product_id: string | null;
    template_html: string | null;
    template_variables: TemplateVariableDef[];
    placeholder_values: Record<string, any>;
  }) => void;
  autofill: AutofillContext;
  disabled?: boolean;
}

interface TemplateOption {
  id: string;
  name: string;
  description?: string | null;
  product_id: string | null;
  is_default: boolean;
  content_html: string;
  variables: TemplateVariableDef[];
}

/* ================================================================== */
/* Heuristics — group variables into friendly steps                    */
/* ================================================================== */

type StepKey = "client" | "company" | "payment";

interface StepDef {
  key: StepKey;
  label: string;
  shortLabel: string;
  icon: any;
  description: string;
}

const STEPS_META: Record<StepKey, StepDef> = {
  client: {
    key: "client",
    label: "Dados de Faturamento",
    shortLabel: "Cliente",
    icon: User,
    description: "Quem é o contratante (razão social, CNPJ, endereço, contato).",
  },
  company: {
    key: "company",
    label: "Dados da Empresa",
    shortLabel: "Empresa",
    icon: Building2,
    description: "Informações da contratada que aparecerão no contrato.",
  },
  payment: {
    key: "payment",
    label: "Valores & Pagamento",
    shortLabel: "Pagamento",
    icon: CreditCard,
    description: "Valor total, parcelas, datas e forma de cobrança.",
  },
};

/**
 * Placeholders fixos da CONTRATADA (Eternum Mentoring Club Ltda).
 * Esses dados estão hardcoded no template e NUNCA devem aparecer no wizard
 * (nem em etapas de preenchimento, nem na revisão, nem no progresso).
 */
const isFixedContratadaKey = (key: string): boolean => {
  const k = (key || "").toUpperCase();
  return (
    /FORO/.test(k) ||
    /CONTRATADA/.test(k) ||
    /ETERNUM/.test(k) ||
    /REPRESENTANTE/.test(k) ||
    /EMPRESA(_|$)/.test(k) ||
    /COMPANY(_|$)/.test(k) ||
    /BANCO|AGENCIA|AGÊNCIA|CONTA_|^CONTA$|^PIX$|PIX_/.test(k) ||
    // Dados da mentoria/produto que já estão fixos no template do contrato
    /MENTORIA/.test(k) ||
    /DIA_?(DA_?)?SEMANA|WEEKDAY|DAY_?OF_?WEEK/.test(k) ||
    /HORARIO|HORÁRIO|HOUR|TIME_?MENTORIA/.test(k) ||
    /PERIODO|PERÍODO|MATUTINO|VESPERTINO|SHIFT/.test(k) ||
    /DURACAO|DURAÇÃO|DURATION|MESES|MONTHS/.test(k)
  );
};

const groupForVariable = (v: TemplateVariableDef): StepKey => {
  const src = (v.source ?? "").toLowerCase();
  const key = v.key.toLowerCase();

  if (src.startsWith("client.")) return "client";
  if (src.startsWith("company.")) return "company";
  if (src.startsWith("deal.")) return "payment";

  // Heuristics by key name
  if (
    /(razao|raz_o|fantasia|cnpj|cpf|inscric|cliente|contratante|email|celular|telefone|rua|bairro|cep|cidade|estado|complemento|numero|endereco|representante)/i.test(
      v.key,
    ) &&
    !/(empresa|contratada|company)/i.test(v.key)
  ) {
    return "client";
  }
  if (/(empresa|contratada|company|banco|agencia|conta|pix)/i.test(key)) return "company";
  if (
    /(valor|preco|parcela|installment|pagto|pagamento|desconto|entrada|down|extenso|moeda|data|dt_|dia_|horario|periodo|duracao|meses|vigencia|foro|cidade_foro|orgao)/i.test(
      key,
    )
  ) {
    return "payment";
  }

  // Currency/date types fallback
  if (v.type === "currency" || v.type === "number" || v.type === "date") return "payment";
  return "client";
};

/* ================================================================== */
/* Field formatting helpers                                            */
/* ================================================================== */

const formatCpfCnpj = (s: string) => {
  const digits = s.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const formatPhone = (s: string) => {
  const d = s.replace(/\D/g, "");
  if (d.length <= 10) {
    return d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a?.length === 2 && ") ", b, c && `-${c}`].filter(Boolean).join(""),
    );
  }
  return d.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
};

const formatBRLInput = (n: number | string) => {
  const num = typeof n === "number" ? n : parseFloat(String(n).replace(",", "."));
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const cleanBRLInput = (s: string) => s.replace(/[^\d,.-]/g, "");

const parseBRLInput = (s: string): number | null => {
  const cleaned = cleanBRLInput(s);
  if (!cleaned || cleaned === "," || cleaned === "." || cleaned === "-") return null;
  const decimalSeparator = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  const integerPart = decimalSeparator >= 0 ? cleaned.slice(0, decimalSeparator).replace(/[^\d-]/g, "") : cleaned.replace(/[^\d-]/g, "");
  const decimalPart = decimalSeparator >= 0 ? cleaned.slice(decimalSeparator + 1).replace(/\D/g, "") : "";
  const normalized = decimalPart ? `${integerPart || "0"}.${decimalPart}` : integerPart;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const guessFieldHelp = (v: TemplateVariableDef): string | null => {
  const k = v.key.toLowerCase();
  if (/cnpj/i.test(v.key)) return "Apenas dígitos. A formatação é automática.";
  if (/cpf/i.test(v.key)) return "Apenas dígitos. A formatação é automática.";
  if (/email/i.test(v.key)) return "Será usado para enviar o contrato e cobrança.";
  if (/celular|telefone|whatsapp/i.test(v.key)) return "Inclua DDD.";
  if (/cep/i.test(v.key)) return "Ex.: 01310-100";
  if (/data/i.test(k)) return "Selecione a data no calendário.";
  if (/parcelas/i.test(v.key)) return "Quantidade de pagamentos mensais.";
  if (/extenso/i.test(v.key)) return "Por extenso, exatamente como deve aparecer no contrato.";
  if (/foro/i.test(v.key)) return "Comarca/UF (ex.: São Paulo/SP).";
  return null;
};

/* ================================================================== */
/* CNPJ Lookup hook                                                    */
/* ================================================================== */

const useCnpjLookup = () => {
  const [loading, setLoading] = useState(false);
  const lookup = async (raw: string): Promise<Record<string, any> | null> => {
    const clean = (raw ?? "").replace(/\D/g, "");
    if (clean.length !== 14) {
      toast.error("CNPJ deve ter 14 dígitos");
      return null;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("hubdev-cnpj-lookup", {
        body: { cnpj: clean },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    } catch (e: any) {
      toast.error(e.message || "Erro ao consultar CNPJ");
      return null;
    } finally {
      setLoading(false);
    }
  };
  return { loading, lookup };
};

const useCpfLookup = () => {
  const [loading, setLoading] = useState(false);
  const lookup = async (raw: string, nascimento?: string): Promise<Record<string, any> | null> => {
    const clean = (raw ?? "").replace(/\D/g, "");
    if (clean.length !== 11) {
      toast.error("CPF deve ter 11 dígitos");
      return null;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("hubdev-cpf-lookup", {
        body: { cpf: clean, nascimento: nascimento || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    } catch (e: any) {
      toast.error(e.message || "Erro ao consultar CPF");
      return null;
    } finally {
      setLoading(false);
    }
  };
  return { loading, lookup };
};

/* ================================================================== */
/* Field renderer                                                      */
/* ================================================================== */

interface FieldProps {
  v: TemplateVariableDef;
  value: any;
  onChange: (val: any) => void;
  disabled?: boolean;
  onCnpjLookup?: (cnpj: string) => void;
  cnpjLooking?: boolean;
  onCpfLookup?: (cpf: string) => void;
  cpfLooking?: boolean;
}

const PlaceholderField = ({ v, value, onChange, disabled, onCnpjLookup, cnpjLooking, onCpfLookup, cpfLooking }: FieldProps) => {
  const [currencyDraft, setCurrencyDraft] = useState<string | null>(null);
  const help = guessFieldHelp(v);
  const isCnpjField = /cnpj/i.test(v.key) && !/empresa|contratada|company/i.test(v.key);
  const isCpfField = /^cpf$|cpf_/i.test(v.key);
  const isPhoneField = /celular|telefone|whatsapp/i.test(v.key);
  const isCurrencyField = v.type === "currency";
  const isFullWidth = v.type === "textarea" || /endereco|rua|complemento|extenso/i.test(v.key);
  const required = v.required;

  let input: React.ReactNode;

  if (v.type === "textarea") {
    input = (
      <Textarea
        rows={3}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={(v.default as any) ?? ""}
      />
    );
  } else if (v.type === "date") {
    input = (
      <Input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    );
  } else if (isCurrencyField) {
    input = (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
          R$
        </span>
        <Input
          inputMode="decimal"
          className="pl-9"
          value={currencyDraft ?? (value === "" || value === null || value === undefined ? "" : formatBRLInput(value))}
          onChange={(e) => {
            const cleaned = cleanBRLInput(e.target.value);
            setCurrencyDraft(cleaned);
            onChange(cleaned === "" ? "" : parseBRLInput(cleaned) ?? cleaned);
          }}
          onBlur={(e) => {
            const cleaned = cleanBRLInput(e.target.value);
            onChange(cleaned === "" ? "" : parseBRLInput(cleaned) ?? "");
            setCurrencyDraft(null);
          }}
          disabled={disabled}
          placeholder="0,00"
        />
      </div>
    );
  } else if (v.type === "number") {
    input = (
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        disabled={disabled}
      />
    );
  } else if (isCnpjField || isCpfField) {
    input = (
      <Input
        value={value ? formatCpfCnpj(String(value)) : ""}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        disabled={disabled}
        placeholder={isCnpjField ? "00.000.000/0000-00" : "000.000.000-00"}
      />
    );
  } else if (isPhoneField) {
    input = (
      <Input
        value={value ? formatPhone(String(value)) : ""}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        disabled={disabled}
        placeholder="(00) 00000-0000"
      />
    );
  } else {
    input = (
      <Input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={(v.default as any) ?? ""}
      />
    );
  }

  return (
    <div className={cn("space-y-1.5", isFullWidth && "sm:col-span-2")}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {v.label || v.key}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {v.source && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] text-primary/70 inline-flex items-center gap-0.5">
                <Sparkles className="h-2.5 w-2.5" /> auto
              </span>
            </TooltipTrigger>
            <TooltipContent>Preenchido automaticamente a partir do cadastro</TooltipContent>
          </Tooltip>
        )}
      </div>
      {input}
      {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
    </div>
  );
};

/* ================================================================== */
/* Stepper UI                                                          */
/* ================================================================== */

const Stepper = ({
  steps,
  current,
  onPick,
  filledCounts,
}: {
  steps: StepDef[];
  current: StepKey | "review";
  onPick: (k: StepKey | "review") => void;
  filledCounts: Record<StepKey, { filled: number; total: number }>;
}) => {
  const all: ({ key: StepKey | "review"; label: string; shortLabel: string; icon: any } )[] = [
    ...steps.map((s) => ({ key: s.key, label: s.label, shortLabel: s.shortLabel, icon: s.icon })),
    { key: "review", label: "Revisar & Gerar", shortLabel: "Revisão", icon: CheckCircle2 },
  ];
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {all.map((s, i) => {
        const Icon = s.icon;
        const isActive = current === s.key;
        const counts = s.key !== "review" ? filledCounts[s.key as StepKey] : null;
        const complete = counts && counts.total > 0 && counts.filled >= counts.total;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onPick(s.key)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all shrink-0",
              "border",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card hover:bg-muted border-border text-foreground",
            )}
          >
            <span
              className={cn(
                "h-5 w-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold",
                isActive
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : complete
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {complete && !isActive ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
            </span>
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{s.shortLabel}</span>
            {counts && counts.total > 0 && (
              <Badge
                variant="secondary"
                className={cn(
                  "h-4 px-1 text-[10px]",
                  isActive && "bg-primary-foreground/20 text-primary-foreground",
                )}
              >
                {counts.filled}/{counts.total}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
};

/* ================================================================== */
/* Main wizard                                                         */
/* ================================================================== */

export const ContractWizard = ({
  templateId,
  productId,
  templateHtml,
  templateVariables,
  placeholderValues,
  onChange,
  autofill,
  disabled,
}: ContractWizardProps) => {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<StepKey | "review">("client");
  const cnpj = useCnpjLookup();
  const cpf = useCpfLookup();
  const [docType, setDocType] = useState<"cnpj" | "cpf">("cnpj");
  const [docInput, setDocInput] = useState("");
  const [docBirth, setDocBirth] = useState("");

  /* ---- Load templates & products ---- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!accountId) return;
      setLoading(true);
      try {
        const [tpls, prods] = await Promise.all([
          supabase
            .from("contract_templates" as any)
            .select("id,name,description,product_id,is_default,content_html,variables,is_active")
            .eq("account_id", accountId)
            .eq("is_active", true)
            .order("is_default", { ascending: false })
            .order("name"),
          supabase
            .from("products")
            .select("id,name")
            .eq("account_id", accountId)
            .eq("is_active", true)
            .order("name"),
        ]);
        if (cancelled) return;
        if (tpls.error) throw tpls.error;
        if (prods.error) throw prods.error;
        setTemplates((tpls.data ?? []) as any);
        setProducts((prods.data ?? []) as any);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message ?? "Erro ao carregar templates");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  /* ---- Group variables ---- */
  // Remove placeholders fixos da CONTRATADA antes de qualquer agrupamento,
  // assim eles não aparecem em nenhuma etapa nem entram no contador de progresso.
  const effectiveVariables = useMemo(
    () => (templateVariables ?? []).filter((v) => !isFixedContratadaKey(v.key)),
    [templateVariables],
  );

  const groupedVars = useMemo(() => {
    const map: Record<StepKey, TemplateVariableDef[]> = {
      client: [],
      company: [],
      payment: [],
    };
    for (const v of effectiveVariables) map[groupForVariable(v)].push(v);
    return map;
  }, [effectiveVariables]);

  const filledCounts = useMemo(() => {
    const counts: Record<StepKey, { filled: number; total: number }> = {
      client: { filled: 0, total: 0 },
      company: { filled: 0, total: 0 },
      payment: { filled: 0, total: 0 },
    };
    (Object.keys(groupedVars) as StepKey[]).forEach((k) => {
      const list = groupedVars[k];
      counts[k].total = list.length;
      counts[k].filled = list.filter((v) => {
        const x = placeholderValues?.[v.key];
        return x !== null && x !== undefined && x !== "";
      }).length;
    });
    return counts;
  }, [groupedVars, placeholderValues]);

  const totalFilled = Object.values(filledCounts).reduce((a, b) => a + b.filled, 0);
  const totalAll = Object.values(filledCounts).reduce((a, b) => a + b.total, 0);
  const progress = totalAll === 0 ? 0 : Math.round((totalFilled / totalAll) * 100);

  // Visible steps (skip empty groups)
  const visibleSteps = useMemo(
    () => (Object.keys(STEPS_META) as StepKey[]).map((k) => STEPS_META[k]).filter((s) => groupedVars[s.key].length > 0),
    [groupedVars],
  );

  // If current step has no vars, jump to first available
  useEffect(() => {
    if (step === "review") return;
    if (!templateHtml) return;
    if (visibleSteps.length === 0) {
      setStep("review");
      return;
    }
    if (!visibleSteps.find((s) => s.key === step)) {
      setStep(visibleSteps[0].key);
    }
  }, [visibleSteps, step, templateHtml]);

  /* ---- Mutations ---- */

  const updateField = (key: string, value: any) => {
    const nextValues: Record<string, any> = { ...placeholderValues, [key]: value };

    // Auto-fill any "extenso" placeholders when a total/contract value changes.
    // Heuristic: triggering field is currency-typed AND its key matches valor/total/contrato/preco
    // (and is NOT itself an extenso/parcela/entrada field).
    const triggerVar = templateVariables.find((tv) => tv.key === key);
    const isCurrencyTrigger = triggerVar?.type === "currency";
    const triggerKeyUpper = key.toUpperCase();
    const isTotalValueKey =
      isCurrencyTrigger &&
      /(VALOR|TOTAL|CONTRATO|PRECO|PREÇO)/.test(triggerKeyUpper) &&
      !/(EXTENSO|PARCELA|ENTRADA|DESCONTO|MENSAL)/.test(triggerKeyUpper);

    if (isTotalValueKey) {
      const numeric = typeof value === "number" ? value : parseBRLInput(String(value ?? ""));
      const extenso = numeric !== null && numeric !== undefined && Number.isFinite(numeric as number)
        ? numberToBRLExtenso(numeric as number)
        : "";
      for (const tv of templateVariables) {
        if (/EXTENSO/.test(tv.key.toUpperCase())) {
          // Always overwrite so the extenso stays in sync with the value.
          nextValues[tv.key] = extenso;
        }
      }
    }

    onChange({
      template_id: templateId,
      product_id: productId,
      template_html: templateHtml,
      template_variables: templateVariables,
      placeholder_values: nextValues,
    });
  };

  const handleProductChange = (newProductId: string | null) => {
    const candidate =
      templates.find((t) => t.product_id === newProductId && t.is_default) ||
      templates.find((t) => t.product_id === newProductId) ||
      null;
    if (candidate) {
      const merged = buildPlaceholderValues(candidate.variables ?? [], autofill, placeholderValues);
      onChange({
        template_id: candidate.id,
        product_id: newProductId,
        template_html: candidate.content_html,
        template_variables: candidate.variables ?? [],
        placeholder_values: merged,
      });
      toast.success(`Modelo "${candidate.name}" carregado`);
    } else {
      onChange({
        template_id: null,
        product_id: newProductId,
        template_html: null,
        template_variables: [],
        placeholder_values: placeholderValues,
      });
      if (newProductId) toast.message("Nenhum modelo vinculado a este produto.");
    }
  };

  const handleTemplateChange = (newTemplateId: string | null) => {
    if (!newTemplateId) {
      onChange({
        template_id: null,
        product_id: productId,
        template_html: null,
        template_variables: [],
        placeholder_values: placeholderValues,
      });
      return;
    }
    const tpl = templates.find((t) => t.id === newTemplateId);
    if (!tpl) return;
    const merged = buildPlaceholderValues(tpl.variables ?? [], autofill, placeholderValues);
    onChange({
      template_id: tpl.id,
      product_id: tpl.product_id ?? productId,
      template_html: tpl.content_html,
      template_variables: tpl.variables ?? [],
      placeholder_values: merged,
    });
    toast.success(`Modelo "${tpl.name}" carregado`);
  };

  const handleResync = () => {
    const fresh = buildPlaceholderValues(templateVariables, autofill, {});
    onChange({
      template_id: templateId,
      product_id: productId,
      template_html: templateHtml,
      template_variables: templateVariables,
      placeholder_values: { ...placeholderValues, ...fresh },
    });
    toast.success("Sincronizado com cliente e deal");
  };

  const applyLookupUpdates = (updates: Record<string, any>) => {
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== null && v !== undefined && v !== ""),
    );
    if (Object.keys(filtered).length === 0) {
      toast.message("Dados encontrados, mas nenhum campo correspondente.");
      return;
    }
    onChange({
      template_id: templateId,
      product_id: productId,
      template_html: templateHtml,
      template_variables: templateVariables,
      placeholder_values: { ...placeholderValues, ...filtered },
    });
    toast.success(`${Object.keys(filtered).length} campo(s) preenchido(s) automaticamente`);
  };

  const handleCnpjLookup = async (raw: string) => {
    const data = await cnpj.lookup(raw);
    if (!data) return;

    const updates: Record<string, any> = {};
    for (const v of templateVariables) {
      const k = v.key.toUpperCase();
      if (/CNPJ/.test(k) && !/EMPRESA|CONTRATADA|COMPANY/.test(k)) {
        updates[v.key] = (raw ?? "").replace(/\D/g, "");
      }
      if ((/RAZAO|NOME(?!_FANTASIA)|FULL_NAME|CLIENT_NAME|CONTRATANTE/.test(k)) && data.razao_social) {
        updates[v.key] = data.razao_social;
      }
      if (k.includes("FANTASIA") && data.nome_fantasia) updates[v.key] = data.nome_fantasia;
      if (k.includes("EMAIL") && data.email) updates[v.key] = data.email;
      if ((k.includes("CELULAR") || k.includes("TELEFONE") || k.includes("PHONE")) && data.telefone) {
        updates[v.key] = data.telefone;
      }
      if ((k === "RUA" || k.includes("LOGRADOURO") || k === "ENDERECO") && data.logradouro) {
        updates[v.key] = data.logradouro;
      }
      if (k.includes("BAIRRO") && data.bairro) updates[v.key] = data.bairro;
      if (k.includes("CEP") && data.cep) updates[v.key] = data.cep;
      if (k.includes("CIDADE") && data.cidade) updates[v.key] = data.cidade;
      if ((k.includes("ESTADO") || k === "UF") && data.estado) updates[v.key] = data.estado;
      if (k === "NUMERO" && data.numero) updates[v.key] = data.numero;
      if (k.includes("COMPLEMENTO") && data.complemento) updates[v.key] = data.complemento;
    }
    applyLookupUpdates(updates);
  };

  const handleCpfLookup = async (raw: string) => {
    if (!docBirth) {
      toast.error("Informe a data de nascimento para consultar o CPF");
      return;
    }
    const data = await cpf.lookup(raw, docBirth);
    if (!data) return;

    const updates: Record<string, any> = {};
    const isoNasc = (() => {
      const s = data.nascimento;
      if (!s || typeof s !== "string") return docBirth || null;
      if (s.includes("/")) {
        const [d, m, y] = s.split("/");
        return `${y}-${m?.padStart(2, "0")}-${d?.padStart(2, "0")}`;
      }
      return s;
    })();
    for (const v of templateVariables) {
      const k = v.key.toUpperCase();
      if (/^CPF$|CPF_|_CPF/.test(k)) {
        updates[v.key] = (raw ?? "").replace(/\D/g, "");
      }
      if ((/NOME|FULL_NAME|CLIENT_NAME|CONTRATANTE|RAZAO/.test(k)) && data.nome) {
        updates[v.key] = data.nome;
      }
      if ((k.includes("NASCIMENTO") || k.includes("BIRTH") || k === "DOB") && isoNasc) {
        updates[v.key] = isoNasc;
      }
    }
    applyLookupUpdates(updates);
  };

  const handleDocLookup = () => {
    if (docType === "cnpj") handleCnpjLookup(docInput);
    else handleCpfLookup(docInput);
  };

  /* ---- Persist client fields back to clients table ---- */
  const persistClientFromPlaceholders = async () => {
    const clientId = autofill.client?.id;
    if (!clientId) return;
    const v = placeholderValues ?? {};
    const updates: Record<string, any> = {};
    const findVal = (regex: RegExp): any => {
      for (const key of Object.keys(v)) {
        if (regex.test(key.toUpperCase()) && v[key] !== "" && v[key] !== null && v[key] !== undefined) {
          // Skip company/contratada keys
          if (/(EMPRESA|CONTRATADA|COMPANY)/.test(key.toUpperCase())) continue;
          return v[key];
        }
      }
      return undefined;
    };
    const onlyDigits = (s: any) => (s == null ? null : String(s).replace(/\D/g, "") || null);

    const cnpj = findVal(/^CNPJ$|CONTRATANTE_CNPJ|CLIENTE_CNPJ|CLIENT_CNPJ/);
    if (cnpj !== undefined) updates.cnpj = onlyDigits(cnpj);
    const cpf = findVal(/^CPF$|CONTRATANTE_CPF|CLIENTE_CPF|CLIENT_CPF/);
    if (cpf !== undefined) updates.cpf = onlyDigits(cpf);
    const rg = findVal(/^RG$|CONTRATANTE_RG|CLIENTE_RG/);
    if (rg !== undefined) updates.rg = String(rg);
    const razao = findVal(/RAZAO_?SOCIAL|RAZÃO_?SOCIAL/);
    if (razao !== undefined) updates.company_name = String(razao);
    const fullName = findVal(/(^|_)NOME(_COMPLETO)?$|FULL_?NAME|CLIENT_?NAME|CONTRATANTE(_NOME)?$/);
    if (fullName !== undefined && !/^CONTRATADA/.test(String(fullName))) updates.full_name = String(fullName);
    const email = findVal(/EMAIL|E_?MAIL/);
    if (email !== undefined) updates.emails = [String(email)];
    const street = findVal(/(^|_)RUA$|LOGRADOURO|^ENDERECO$|^ENDEREÇO$/);
    if (street !== undefined) updates.street = String(street);
    const num = findVal(/^NUMERO$|NUM_END|NUMERO_ENDERECO/);
    if (num !== undefined) updates.street_number = String(num);
    const compl = findVal(/COMPLEMENTO/);
    if (compl !== undefined) updates.complement = String(compl);
    const bairro = findVal(/BAIRRO/);
    if (bairro !== undefined) updates.neighborhood = String(bairro);
    const cidade = findVal(/(^|_)CIDADE$/);
    if (cidade !== undefined) updates.city = String(cidade);
    const estado = findVal(/(^|_)ESTADO$|^UF$/);
    if (estado !== undefined) updates.state = String(estado);
    const cep = findVal(/(^|_)CEP$|ZIP/);
    if (cep !== undefined) updates.zip_code = String(cep);
    const birth = findVal(/NASCIMENTO|BIRTH|^DOB$/);
    if (birth !== undefined && /^\d{4}-\d{2}-\d{2}/.test(String(birth))) updates.birth_date = String(birth).slice(0, 10);

    if (Object.keys(updates).length === 0) return;
    try {
      const { error } = await supabase.from("clients").update(updates).eq("id", clientId);
      if (error) throw error;
    } catch (e: any) {
      // Não bloqueia o fluxo do contrato — só avisa.
      console.warn("[ContractWizard] persistClientFromPlaceholders:", e?.message);
    }
  };



  /* ---- Render ---- */

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ============= NO TEMPLATE: model picker only =============
  if (!templateHtml) {
    return (
      <TooltipProvider delayDuration={150}>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="border-b border-border p-5 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold">Vamos preparar o contrato</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Escolha o produto vendido — o modelo correto será carregado automaticamente.
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/sales/contracts/templates">
                  <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                  Modelos
                </Link>
              </Button>
            </div>
          </div>

          {/* Selectors */}
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Produto vendido
                <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Select
                disabled={disabled}
                value={productId ?? "__none__"}
                onValueChange={(v) => handleProductChange(v === "__none__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                O modelo padrão associado a este produto será carregado.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Ou escolher modelo manualmente</Label>
              <Select
                disabled={disabled}
                value={templateId ?? "__none__"}
                onValueChange={(v) => handleTemplateChange(v === "__none__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.is_default ? " · padrão" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Use quando quiser um modelo diferente do padrão do produto.
              </p>
            </div>
          </div>

          {templates.length === 0 && (
            <div className="mx-5 mb-5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Nenhum modelo cadastrado ainda.</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Crie modelos reutilizáveis em{" "}
                  <Link to="/sales/contracts/templates" className="text-primary underline underline-offset-2">
                    Modelos de Contrato
                  </Link>
                  .
                </p>
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // ============= WITH TEMPLATE: full wizard =============

  const currentTemplateName =
    templates.find((t) => t.id === templateId)?.name ?? "Modelo carregado";

  const renderStepContent = () => {
    if (step === "review") {
      return (
        <div className="space-y-4">
          {totalFilled < totalAll && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">
                  {totalAll - totalFilled} campo(s) ainda não preenchido(s)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aparecerão como <code className="bg-background px-1 rounded">[ • ]</code> no contrato. Volte às etapas anteriores para preencher.
                </p>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-border bg-muted/30 p-4 max-h-[70vh] overflow-auto">
            <TemplatedContractPreview
              templateHtml={templateHtml}
              templateVariables={templateVariables}
              placeholderValues={placeholderValues}
            />
          </div>
        </div>
      );
    }

    const list = groupedVars[step];
    const meta = STEPS_META[step];
    const Icon = meta.icon;

    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold">{meta.label}</h3>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            </div>
          </div>
          {step === "client" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleResync} disabled={disabled}>
                  <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                  Preencher do cadastro
                </Button>
              </TooltipTrigger>
              <TooltipContent>Buscar dados do cliente já cadastrados no CRM</TooltipContent>
            </Tooltip>
          )}
        </div>

        {step === "client" && (
          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-foreground">
                Buscar dados do contratante
              </span>
              <span className="text-[11px] text-muted-foreground">
                {docType === "cnpj"
                  ? "Preenche automaticamente nome, endereço e contatos."
                  : "Informe o CPF e preencha os demais dados manualmente."}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex rounded-md border border-input overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setDocType("cnpj")}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    docType === "cnpj"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                  disabled={disabled}
                >
                  CNPJ
                </button>
                <button
                  type="button"
                  onClick={() => setDocType("cpf")}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    docType === "cpf"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                  disabled={disabled}
                >
                  CPF
                </button>
              </div>
              <Input
                value={docInput ? formatCpfCnpj(docInput) : ""}
                onChange={(e) => setDocInput(e.target.value.replace(/\D/g, ""))}
                placeholder={docType === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00"}
                disabled={disabled}
                className="h-9 flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && docType === "cnpj") {
                    e.preventDefault();
                    handleDocLookup();
                  }
                }}
              />
              {docType === "cnpj" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleDocLookup}
                  disabled={disabled || cnpj.loading || !docInput}
                  className="shrink-0 gap-1.5"
                >
                  {cnpj.loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  Buscar
                </Button>
              )}
            </div>
          </div>
        )}

        {(() => {
          // Placeholders fixos já foram removidos em `effectiveVariables`.
          // Aqui só filtramos campos de documento do contratante (CPF/CNPJ),
          // que são tratados pelo bloco de busca acima.
          let visibleList = step === "client"
            ? list.filter((v) => {
                const isContractorCnpj = /cnpj/i.test(v.key) && !/empresa|contratada|company/i.test(v.key);
                const isContractorCpf = /^cpf$|cpf_/i.test(v.key);
                return !isContractorCnpj && !isContractorCpf;
              })
            : list;

          // Quando CPF (PF) está selecionado, esconde Nome Fantasia / IE / IM
          // e converte "Razão Social" em "Nome completo" (mantendo o placeholder
          // do template para que o conteúdo continue sendo preenchido).
          if (step === "client" && docType === "cpf") {
            visibleList = visibleList.filter((v) => {
              const k = v.key.toUpperCase();
              const isHidden =
                /FANTASIA/.test(k) ||
                /INSCRICAO_?(MUNICIPAL|ESTADUAL)|INSCRIÇÃO_?(MUNICIPAL|ESTADUAL)|^IE$|^IM$|_IE$|_IM$/.test(k);
              return !isHidden;
            });

            const isNameKey = (k: string) =>
              /NOME(_COMPLETO)?$|FULL_?NAME|CLIENT_?NAME|CONTRATANTE(_NOME)?$|^NOME$|RAZAO_?SOCIAL|RAZÃO_?SOCIAL/.test(
                k.toUpperCase(),
              );

            // Renomeia "Razão Social" -> "Nome completo" no modo PF
            visibleList = visibleList.map((v) => {
              if (/RAZAO_?SOCIAL|RAZÃO_?SOCIAL/.test(v.key.toUpperCase())) {
                return { ...v, label: "Nome completo" };
              }
              return v;
            });

            // Garante que exista pelo menos um campo de nome; se não houver,
            // injeta um campo virtual "Nome completo" no topo.
            const hasName = visibleList.some((v) => isNameKey(v.key));
            if (!hasName) {
              visibleList = [
                {
                  key: "NOME_COMPLETO",
                  label: "Nome completo",
                  type: "text",
                  required: true,
                } as TemplateVariableDef,
                ...visibleList,
              ];
            }

            // Coloca o campo de "nome completo" como primeiro
            visibleList = [...visibleList].sort((a, b) => {
              const aIsName = isNameKey(a.key);
              const bIsName = isNameKey(b.key);
              if (aIsName && !bIsName) return -1;
              if (bIsName && !aIsName) return 1;
              return 0;
            });
          }
          return visibleList.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nada para preencher nesta etapa.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-4">
            {visibleList.map((v) => (
              <PlaceholderField
                key={v.key}
                v={v}
                value={placeholderValues?.[v.key]}
                onChange={(val) => updateField(v.key, val)}
                disabled={disabled}
                onCnpjLookup={step === "client" ? handleCnpjLookup : undefined}
                cnpjLooking={cnpj.loading}
                onCpfLookup={undefined}
                cpfLooking={false}
              />
            ))}
          </div>
        );
        })()}
      </div>
    );
  };

  // Navigation helpers
  const allKeys: (StepKey | "review")[] = [...visibleSteps.map((s) => s.key), "review"];
  const currentIdx = allKeys.indexOf(step);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < allKeys.length - 1;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Top bar */}
        <div className="border-b border-border p-4 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Modelo aplicado</p>
                <p className="text-sm font-semibold truncate">{currentTemplateName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select
                disabled={disabled}
                value={templateId ?? "__none__"}
                onValueChange={(v) => handleTemplateChange(v === "__none__" ? null : v)}
              >
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="Trocar modelo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.is_default ? " · padrão" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleResync} disabled={disabled}>
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Re-sincronizar com cliente / deal</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {totalFilled} de {totalAll} campos preenchidos
              </span>
              <span className="font-semibold tabular-nums">{progress}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  progress >= 100 ? "bg-emerald-500" : "bg-primary",
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Stepper */}
          <Stepper steps={visibleSteps} current={step} onPick={setStep} filledCounts={filledCounts} />
        </div>

        {/* Step content */}
        <div className="p-5 min-h-[300px]">{renderStepContent()}</div>

        {/* Footer nav */}
        <div className="border-t border-border p-3 flex items-center justify-between gap-2 bg-muted/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => canPrev && setStep(allKeys[currentIdx - 1])}
            disabled={!canPrev || disabled}
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            Voltar
          </Button>

          <div className="text-xs text-muted-foreground hidden sm:block">
            Etapa {currentIdx + 1} de {allKeys.length}
          </div>

          {step === "review" ? (
            <Button size="sm" variant="outline" onClick={() => setStep(visibleSteps[0]?.key ?? "client")}>
              Voltar ao formulário
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => canNext && setStep(allKeys[currentIdx + 1])}
              disabled={!canNext || disabled}
            >
              {allKeys[currentIdx + 1] === "review" ? (
                <>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Revisar contrato
                </>
              ) : (
                <>
                  Continuar
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <style>{`
        .contract-doc-preview h1, .contract-doc-preview h2, .contract-doc-preview h3 {
          font-family: Georgia, 'Times New Roman', serif;
        }
        .contract-doc-preview h2 {
          font-size: 1rem;
          font-weight: 700;
          text-transform: uppercase;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .contract-doc-preview p { line-height: 1.6; text-align: justify; }
      `}</style>
    </TooltipProvider>
  );
};
