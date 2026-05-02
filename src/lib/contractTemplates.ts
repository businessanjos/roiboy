// Utilities for handling contract templates with placeholders.

import { numberToBRLExtenso } from "@/lib/numberToWordsBRL";

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
    id?: string | null;
    full_name?: string | null;
    cpf?: string | null;
    cnpj?: string | null;
    rg?: string | null;
    email?: string | null;
    address?: string | null;
    phone?: string | null;
    razao_social?: string | null;
    nome_fantasia?: string | null;
    inscricao_municipal?: string | null;
    inscricao_estadual?: string | null;
    street?: string | null;
    street_number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
    birth_date?: string | null;
    nationality?: string | null;
    marital_status?: string | null;
  };
  deal?: {
    value?: number | null;
    installments?: number | null;
    installment_value?: number | null;
    entry_value?: number | null;
    payment_method?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  };
  product?: {
    payment_method?: string | null;
    installments?: number | null;
    billing_period?: string | null;
    duration_months?: number | null;
  };
  user?: {
    name?: string | null;
    email?: string | null;
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

export interface ContractorIdentity {
  client_name?: string | null;
  client_cpf_cnpj?: string | null;
  client_email?: string | null;
  client_address?: string | null;
  client_nationality?: string | null;
  client_marital_status?: string | null;
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

/* ------------------------------------------------------------------ */
/* Heuristic key-based autofill                                       */
/* ------------------------------------------------------------------ */

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "PIX",
  boleto: "Boleto bancário",
  cheque: "Cheque",
  bank_transfer: "Transferência bancária",
  cash: "Dinheiro",
};

const labelPaymentMethod = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  return PAYMENT_METHOD_LABELS[raw] ?? raw;
};

const billingPeriodToMonths = (bp: string | null | undefined): number | null => {
  switch ((bp ?? "").toLowerCase()) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "semiannual":
    case "semi_annual":
    case "biannual":
      return 6;
    case "annual":
    case "yearly":
      return 12;
    default:
      return null;
  }
};

const addMonthsISO = (isoDate: string, months: number): string => {
  const base = new Date(isoDate.length <= 10 ? isoDate + "T12:00:00" : isoDate);
  if (Number.isNaN(base.getTime())) return isoDate;
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

/** For a given placeholder key, infer a value from the autofill context using common naming patterns. */
const inferValueFromKey = (
  v: TemplateVariableDef,
  ctx: AutofillContext,
  currentValues: Record<string, any>,
): string | number | null => {
  const K = v.key.toUpperCase();

  // VALOR EXTENSO — derived from the total/contract value already in values
  if (/EXTENSO/.test(K)) {
    const totalKey = Object.keys(currentValues).find(
      (k) =>
        /(VALOR|TOTAL|CONTRATO|PRECO|PREÇO)/.test(k.toUpperCase()) &&
        !/(EXTENSO|PARCELA|ENTRADA|DESCONTO|MENSAL)/.test(k.toUpperCase()),
    );
    if (totalKey) {
      const raw = currentValues[totalKey];
      const num = typeof raw === "number" ? raw : parseFloat(String(raw ?? "").replace(",", "."));
      if (Number.isFinite(num)) return numberToBRLExtenso(num);
    }
    return null;
  }

  // VALOR ENTRADA / DOWN
  if (/(ENTRADA|DOWN_PAYMENT|SINAL)/.test(K) && /(VALOR|PRECO|PREÇO|TOTAL)/.test(K)) {
    return ctx.deal?.entry_value ?? null;
  }
  if (K === "VALOR_ENTRADA" || K === "ENTRADA") {
    return ctx.deal?.entry_value ?? null;
  }

  // VALOR TOTAL / CONTRATO
  if (
    /(VALOR|TOTAL|CONTRATO|PRECO|PREÇO)/.test(K) &&
    !/(EXTENSO|PARCELA|ENTRADA|DESCONTO|MENSAL|UNITARIO)/.test(K)
  ) {
    return ctx.deal?.value ?? null;
  }

  // VALOR DA PARCELA
  if (/(PARCELA|INSTALLMENT|MENSAL).*VALOR|VALOR.*(PARCELA|INSTALLMENT|MENSAL)/.test(K)) {
    if (ctx.deal?.installment_value != null) return ctx.deal.installment_value;
    const total = ctx.deal?.value ?? null;
    const installments = ctx.deal?.installments ?? ctx.product?.installments ?? null;
    if (total && installments && installments > 0) return Number((total / installments).toFixed(2));
    return null;
  }

  // NÚMERO DE PARCELAS / QTD PARCELAS
  if (/(NUMERO|N|QTD|QUANTIDADE).*(PARCELAS?|INSTALLMENTS?)/.test(K) || K === "PARCELAS" || K === "NUM_PARCELAS") {
    return ctx.deal?.installments ?? ctx.product?.installments ?? null;
  }

  // FORMA DE PAGAMENTO
  if (/(FORMA|METODO|MEIO).*PAG/.test(K) || K === "PAGAMENTO" || K === "FORMA_PAGAMENTO") {
    return labelPaymentMethod(ctx.deal?.payment_method ?? ctx.product?.payment_method ?? null);
  }

  // DATAS DE VIGÊNCIA
  if (/(DATA|DT)?_?INICIO|VIGENCIA_INICIO|START_DATE/.test(K)) {
    return ctx.deal?.start_date ?? ctx.today ?? null;
  }
  if (/(DATA|DT)?_?FIM|VIGENCIA_FIM|END_DATE|TERMINO/.test(K)) {
    if (ctx.deal?.end_date) return ctx.deal.end_date;
    const start = ctx.deal?.start_date ?? ctx.today ?? null;
    const months =
      ctx.product?.duration_months ?? billingPeriodToMonths(ctx.product?.billing_period ?? null) ?? null;
    if (start && months) return addMonthsISO(start, months);
    return null;
  }

  // VENDEDOR / RESPONSAVEL
  if (/VENDEDOR.*(EMAIL|MAIL)|EMAIL.*VENDEDOR|RESPONSAVEL.*EMAIL/.test(K)) {
    return ctx.user?.email ?? null;
  }
  if (/VENDEDOR|RESPONSAVEL_COMERCIAL|CLOSER|CONSULTOR/.test(K) && !/EMAIL/.test(K)) {
    return ctx.user?.name ?? null;
  }

  // ============== CONTRATANTE (Cliente) — heurísticas por nome ==============
  const c = ctx.client ?? {};
  const isContratada = /(EMPRESA|CONTRATADA|COMPANY)/.test(K);
  if (!isContratada) {
    if (/^CNPJ$|CONTRATANTE_CNPJ|CLIENTE_CNPJ|CLIENT_CNPJ/.test(K)) return c.cnpj ?? null;
    if (/^CPF$|CONTRATANTE_CPF|CLIENTE_CPF|CLIENT_CPF/.test(K)) return c.cpf ?? null;
    if (/^RG$|CONTRATANTE_RG|CLIENTE_RG/.test(K)) return c.rg ?? null;
    if (/RAZAO_?SOCIAL|RAZÃO_?SOCIAL/.test(K)) return c.razao_social ?? c.full_name ?? null;
    if (/NOME_?FANTASIA|FANTASIA/.test(K)) return c.nome_fantasia ?? null;
    if (/INSCRICAO_?MUNICIPAL|INSCRIÇÃO_?MUNICIPAL|^IM$|_IM$/.test(K)) return c.inscricao_municipal ?? null;
    if (/INSCRICAO_?ESTADUAL|INSCRIÇÃO_?ESTADUAL|^IE$|_IE$/.test(K)) return c.inscricao_estadual ?? null;
    if (/(^|_)NOME(_COMPLETO)?$|FULL_?NAME|CLIENT_?NAME|CONTRATANTE(_NOME)?$/.test(K)) {
      return c.full_name ?? c.razao_social ?? null;
    }
    if (/EMAIL|E_?MAIL/.test(K)) return c.email ?? null;
    if (/CELULAR|TELEFONE|WHATSAPP|PHONE/.test(K)) return c.phone ?? null;
    if (/(^|_)CEP$|ZIP/.test(K)) return c.zip_code ?? null;
    if (/(^|_)RUA$|LOGRADOURO|^ENDERECO$|^ENDEREÇO$/.test(K)) return c.street ?? c.address ?? null;
    if (/^NUMERO$|NUM_END|NUMERO_ENDERECO/.test(K)) return c.street_number ?? null;
    if (/COMPLEMENTO/.test(K)) return c.complement ?? null;
    if (/BAIRRO/.test(K)) return c.neighborhood ?? null;
    if (/(^|_)CIDADE$/.test(K) && !/FORO/.test(K)) return c.city ?? null;
    if (/(^|_)ESTADO$|^UF$/.test(K)) return c.state ?? null;
    if (/NASCIMENTO|BIRTH|^DOB$/.test(K)) return c.birth_date ?? null;
    if (/NACIONALIDADE|NATIONALITY/.test(K)) return c.nationality ?? null;
    if (/ESTADO_?CIVIL|MARITAL/.test(K)) return c.marital_status ?? null;
  }

  return null;
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

  // First pass: explicit sources + key-name heuristics for non-derived fields
  for (const v of variables) {
    if (out[v.key] !== undefined && out[v.key] !== null && out[v.key] !== "") continue;
    const fromSource = resolveSource(v.source, ctx);
    if (fromSource !== null && fromSource !== undefined && fromSource !== "") {
      out[v.key] = fromSource;
      continue;
    }
    // Heuristic by key name (skip extenso — needs second pass)
    if (!/EXTENSO/i.test(v.key)) {
      const inferred = inferValueFromKey(v, ctx, out);
      if (inferred !== null && inferred !== undefined && inferred !== "") {
        out[v.key] = inferred;
        continue;
      }
    }
    if (v.default !== undefined && v.default !== null) {
      out[v.key] = v.default;
    } else if (out[v.key] === undefined) {
      out[v.key] = "";
    }
  }

  // Second pass: derive EXTENSO fields from now-populated total values
  for (const v of variables) {
    if (!/EXTENSO/i.test(v.key)) continue;
    if (out[v.key] !== undefined && out[v.key] !== null && out[v.key] !== "") continue;
    const inferred = inferValueFromKey(v, ctx, out);
    if (inferred !== null && inferred !== undefined && inferred !== "") {
      out[v.key] = inferred;
    }
  }

  return out;
};

/**
 * Force every contractor/cliente placeholder to use the Mentorado identity.
 * Some legacy templates contain placeholders that are not listed in
 * `template_variables`, so this scans variables, saved values and raw HTML.
 */
export const mergeContractorPlaceholders = (
  templateHtml: string | null | undefined,
  variables: TemplateVariableDef[],
  values: Record<string, any>,
  contractor?: ContractorIdentity | null,
): Record<string, any> => {
  if (!contractor) return values ?? {};
  const out: Record<string, any> = { ...(values ?? {}) };
  const keys = new Set<string>([
    ...Object.keys(out),
    ...(variables ?? []).map((v) => v.key),
  ]);
  const re = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(templateHtml ?? ""))) keys.add(match[1]);

  const name = contractor.client_name ?? "";
  const cpf = contractor.client_cpf_cnpj == null ? "" : String(contractor.client_cpf_cnpj).replace(/\D/g, "");
  const email = contractor.client_email ?? "";
  const address = contractor.client_address ?? "";

  for (const key of keys) {
    const K = key.toUpperCase();
    if (/(EMPRESA|CONTRATADA|COMPANY)/.test(K)) continue;

    if (/^CNPJ$|CONTRATANTE_CNPJ|CLIENTE_CNPJ|CLIENT_CNPJ/.test(K)) {
      out[key] = "";
    } else if (/^CPF$|CONTRATANTE_CPF|CLIENTE_CPF|CLIENT_CPF|CLIENT_DOCUMENT|^DOCUMENTO$|CPF_CNPJ|CNPJ_CPF/.test(K)) {
      out[key] = cpf;
    } else if (/RAZAO_?SOCIAL|RAZÃO_?SOCIAL|NOME_?FANTASIA|FANTASIA|CLIENT_?NAME|FULL_?NAME|^CONTRATANTE$|CONTRATANTE_NOME|(^|_)NOME(_COMPLETO)?$|NOME_PLACEHOLDER/.test(K)) {
      out[key] = name;
    } else if (/INSCRICAO_?(MUNICIPAL|ESTADUAL)|INSCRIÇÃO_?(MUNICIPAL|ESTADUAL)|^IE$|^IM$|_IE$|_IM$/.test(K)) {
      out[key] = "";
    } else if (/^EMAIL$|^E_?MAIL$|CLIENT_EMAIL|CONTRATANTE_EMAIL|EMAIL_CONTRATANTE/.test(K)) {
      out[key] = email;
    } else if (/^ENDERECO$|^ENDEREÇO$|CLIENT_ADDRESS|CONTRATANTE_ENDERECO|ENDERECO_CONTRATANTE|^RUA$|LOGRADOURO/.test(K)) {
      out[key] = address;
    } else if (/NACIONALIDADE|NATIONALITY/.test(K)) {
      out[key] = contractor.client_nationality ?? "";
    } else if (/ESTADO_?CIVIL|MARITAL/.test(K)) {
      out[key] = contractor.client_marital_status ?? "";
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

/**
 * Aliases between common English-style placeholders used in legacy templates
 * and the Portuguese variable keys actually managed by the wizard.
 * When a {{KEY}} in the HTML has no value, we try its aliases to find one.
 */
const PLACEHOLDER_ALIASES: Record<string, string[]> = {
  // Cliente / Contratante
  CLIENT_NAME: ["RAZAO_SOCIAL", "NOME_COMPLETO", "NOME", "CONTRATANTE", "FULL_NAME"],
  CLIENT_DOCUMENT: ["CNPJ", "CPF", "DOCUMENTO"],
  CLIENT_EMAIL: ["EMAIL", "E_MAIL"],
  CLIENT_PHONE: ["CELULAR", "TELEFONE", "WHATSAPP", "PHONE"],
  CLIENT_ADDRESS: ["ENDERECO", "ENDEREÇO", "RUA", "LOGRADOURO"],
  RAZAO_SOCIAL: ["CLIENT_NAME", "NOME_COMPLETO", "CONTRATANTE"],
  CNPJ: ["CLIENT_DOCUMENT"],
  CPF: ["CLIENT_DOCUMENT"],
  EMAIL: ["CLIENT_EMAIL"],
  CELULAR: ["CLIENT_PHONE", "TELEFONE"],
  TELEFONE: ["CLIENT_PHONE", "CELULAR"],
  // Produto
  PRODUCT_NAME: ["PRODUTO", "PROGRAMA", "MENTORIA"],
  // Valores
  TOTAL_VALUE: ["VALOR_TOTAL", "VALOR", "INVESTIMENTO", "INVESTIMENTO_TOTAL"],
  TOTAL_VALUE_WORDS: ["VALOR_TOTAL_EXTENSO", "VALOR_EXTENSO", "EXTENSO"],
  VALOR_TOTAL: ["TOTAL_VALUE"],
  VALOR_TOTAL_EXTENSO: ["TOTAL_VALUE_WORDS"],
  DOWN_PAYMENT: ["VALOR_ENTRADA", "ENTRADA"],
  INSTALLMENTS: ["PARCELAS", "NUM_PARCELAS", "NUMERO_PARCELAS"],
  PARCELAS: ["INSTALLMENTS"],
  PAYMENT_METHOD: ["FORMA_PAGAMENTO", "PAGAMENTO", "FORMA_DE_PAGAMENTO"],
  DUE_DATE: ["DATA_VENCIMENTO", "VENCIMENTO", "DATA_PRIMEIRA_PARCELA"],
  // Vigência / datas
  CONTRACT_DURATION: ["DURACAO_MESES", "DURACAO", "VIGENCIA"],
  CONTRACT_DATE: ["DATA_ASSINATURA", "DATA_CELEBRACAO", "DATA_CONTRATO"],
  START_DATE: ["DATA_INICIO", "VIGENCIA_INICIO", "DATA_PRIMEIRA_PARCELA"],
  END_DATE: ["DATA_FIM", "VIGENCIA_FIM", "DATA_TERMINO"],
  SIGNATURE_DATE: ["DATA_ASSINATURA", "DATA_CONTRATO"],
  SIGNATURE_CITY: ["CIDADE_ASSINATURA", "CIDADE", "CIDADE_FORO"],
  JURISDICTION: ["FORO", "CIDADE_FORO", "COMARCA"],
};

const resolveValueByKey = (
  key: string,
  values: Record<string, any>,
): { value: any; aliasedFrom?: string } => {
  const direct = values?.[key];
  if (direct !== undefined && direct !== null && direct !== "") return { value: direct };
  const aliases = PLACEHOLDER_ALIASES[key] ?? [];
  for (const alias of aliases) {
    const v = values?.[alias];
    if (v !== undefined && v !== null && v !== "") return { value: v, aliasedFrom: alias };
  }
  return { value: direct };
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
    const resolved = resolveValueByKey(key, values);
    // Prefer the type of the actual key, else of the alias source
    const t = typeMap.get(key) ?? (resolved.aliasedFrom ? typeMap.get(resolved.aliasedFrom) : undefined);
    return formatValueForRender(resolved.value, t);
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
  { value: "deal.entry_value", label: "Deal · Valor de entrada" },
  { value: "deal.installments", label: "Deal · Nº de parcelas" },
  { value: "deal.installment_value", label: "Deal · Valor da parcela" },
  { value: "deal.payment_method", label: "Deal · Forma de pagamento" },
  { value: "deal.start_date", label: "Deal · Data de início" },
  { value: "deal.end_date", label: "Deal · Data de término" },
  { value: "product.payment_method", label: "Produto · Forma de pagamento (padrão)" },
  { value: "product.installments", label: "Produto · Nº de parcelas (padrão)" },
  { value: "user.name", label: "Vendedor · Nome (usuário logado)" },
  { value: "user.email", label: "Vendedor · E-mail (usuário logado)" },
  { value: "company.name", label: "Contratada · Razão Social" },
  { value: "company.cnpj", label: "Contratada · CNPJ" },
  { value: "company.address", label: "Contratada · Endereço" },
  { value: "company.representative", label: "Contratada · Representante" },
  { value: "company.email", label: "Contratada · E-mail" },
  { value: "today", label: "Data atual" },
];
