// Utilities for handling contract templates with placeholders.

export type TemplateVariableType = "text" | "textarea" | "number" | "currency" | "date";

export interface TemplateVariableDef {
  /** Placeholder key used in the template body, e.g. "RAZAO_SOCIAL" -> {{RAZAO_SOCIAL}} */
  key: string;
  /** Human label shown in the editor */
  label: string;
  type: TemplateVariableType;
  /** Optional source path for autofill: client.full_name | client.cnpj | client.cpf | client.email | client.address | deal.value | deal.installments | company.name | company.cnpj | etc. */
  source?: string | null;
  /** Default value if no source / no fill */
  default?: string | number | null;
  required?: boolean;
  /** Hint shown below input */
  hint?: string;
}

export interface AutofillContext {
  client?: {
    full_name?: string | null;
    cpf?: string | null;
    cnpj?: string | null;
    email?: string | null;
    address?: string | null;
    phone?: string | null;
    razao_social?: string | null;
    nome_fantasia?: string | null;
    inscricao_municipal?: string | null;
    inscricao_estadual?: string | null;
  };
  deal?: {
    value?: number | null;
    installments?: number | null;
    installment_value?: number | null;
  };
  company?: {
    name?: string | null;
    cnpj?: string | null;
    address?: string | null;
    representative?: string | null;
    email?: string | null;
  };
  today?: string;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string) => {
  try {
    return new Date(d.length <= 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

/** Resolve "client.full_name" => ctx.client.full_name */
export const resolveSource = (source: string | null | undefined, ctx: AutofillContext): string | number | null => {
  if (!source) return null;
  const [scope, key] = source.split(".");
  const obj = (ctx as any)?.[scope];
  if (!obj) return null;
  const v = obj[key];
  return v ?? null;
};

/** Build placeholder values map by combining defaults, autofill from sources and existing user-provided values. */
export const buildPlaceholderValues = (
  variables: TemplateVariableDef[],
  ctx: AutofillContext,
  existing: Record<string, any> = {},
): Record<string, any> => {
  const out: Record<string, any> = { ...existing };
  for (const v of variables) {
    // Keep user-edited value if present and non-empty
    if (out[v.key] !== undefined && out[v.key] !== null && out[v.key] !== "") continue;
    const fromSource = resolveSource(v.source, ctx);
    if (fromSource !== null && fromSource !== undefined && fromSource !== "") {
      out[v.key] = fromSource;
    } else if (v.default !== undefined && v.default !== null) {
      out[v.key] = v.default;
    } else {
      out[v.key] = "";
    }
  }
  return out;
};

const formatValueForRender = (v: any, type?: TemplateVariableType) => {
  if (v === null || v === undefined || v === "") return `<span class="text-muted-foreground">[ • ]</span>`;
  if (type === "currency") {
    const num = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
    return Number.isFinite(num) ? formatBRL(num) : String(v);
  }
  if (type === "date") return formatDate(String(v));
  if (type === "number") return String(v);
  return String(v);
};

/** Replace {{KEY}} in the template HTML with values, applying type-aware formatting. */
export const renderTemplate = (
  templateHtml: string,
  variables: TemplateVariableDef[],
  values: Record<string, any>,
): string => {
  if (!templateHtml) return "";
  const typeMap = new Map(variables.map((v) => [v.key, v.type]));
  return templateHtml.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const t = typeMap.get(key);
    return formatValueForRender(values?.[key], t);
  });
};

/** Extract placeholders ({{KEY}}) from a template body. Useful to suggest variables when editing the template. */
export const extractPlaceholders = (html: string): string[] => {
  if (!html) return [];
  const set = new Set<string>();
  const re = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) set.add(m[1]);
  return Array.from(set);
};

/** Common autofill source options shown in the variable editor. */
export const AUTOFILL_SOURCES: { value: string; label: string }[] = [
  { value: "", label: "— Sem auto-preenchimento —" },
  { value: "client.full_name", label: "Cliente · Nome / Razão Social" },
  { value: "client.razao_social", label: "Cliente · Razão Social" },
  { value: "client.nome_fantasia", label: "Cliente · Nome Fantasia" },
  { value: "client.cpf", label: "Cliente · CPF" },
  { value: "client.cnpj", label: "Cliente · CNPJ" },
  { value: "client.email", label: "Cliente · E-mail" },
  { value: "client.phone", label: "Cliente · Telefone" },
  { value: "client.address", label: "Cliente · Endereço completo" },
  { value: "client.inscricao_municipal", label: "Cliente · Inscrição Municipal" },
  { value: "client.inscricao_estadual", label: "Cliente · Inscrição Estadual" },
  { value: "deal.value", label: "Deal · Valor total" },
  { value: "deal.installments", label: "Deal · Nº de parcelas" },
  { value: "deal.installment_value", label: "Deal · Valor da parcela" },
  { value: "company.name", label: "Contratada · Razão Social" },
  { value: "company.cnpj", label: "Contratada · CNPJ" },
  { value: "company.address", label: "Contratada · Endereço" },
  { value: "company.representative", label: "Contratada · Representante" },
  { value: "company.email", label: "Contratada · E-mail" },
  { value: "today", label: "Data atual" },
];
