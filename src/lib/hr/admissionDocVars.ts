import DOMPurify from "dompurify";

export interface SignerField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  half?: boolean;
}

/** Campos preenchidos pelo colaborador e usados em todos os modelos. */
export const SIGNER_FIELDS: SignerField[] = [
  { key: "NOME_COMPLETO", label: "Nome completo", placeholder: "Como consta no RG", required: true },
  { key: "CPF", label: "CPF", placeholder: "000.000.000-00", required: true, half: true },
  { key: "RG", label: "RG", placeholder: "00.000.000-0", required: true, half: true },
  { key: "RUA", label: "Rua / logradouro", placeholder: "Rua das Flores", required: true },
  { key: "NUMERO", label: "Número", placeholder: "550", required: true, half: true },
  { key: "BAIRRO", label: "Bairro", placeholder: "Centro", required: true, half: true },
  { key: "CIDADE", label: "Cidade", placeholder: "Barueri", required: true, half: true },
  { key: "ESTADO", label: "Estado (UF)", placeholder: "SP", required: true, half: true },
];

export const SIGNER_KEYS = SIGNER_FIELDS.map((f) => f.key);

/** Todas as variáveis suportadas nos modelos (para exibir na biblioteca do RH). */
export const TEMPLATE_VARIABLES = [...SIGNER_KEYS, "DATA_ASSINATURA"];

export function formatSignatureDate(date = new Date()): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Substitui {{VARIAVEL}} pelos valores informados. Mantém o placeholder visível quando vazio. */
export function renderTemplate(html: string, values: Record<string, string>): string {
  const all: Record<string, string> = { DATA_ASSINATURA: formatSignatureDate(), ...values };
  return (html || "").replace(/\{\{([A-Z_0-9]+)\}\}/g, (match, key: string) => {
    const v = (all[key] || "").trim();
    return v
      ? `<span class="tpl-filled">${escapeHtml(v)}</span>`
      : `<span class="tpl-missing">${match}</span>`;
  });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DOC_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "table", "thead", "tbody", "tr", "th", "td", "hr", "span", "div", "sup", "sub",
  ],
  ALLOWED_ATTR: ["class", "colspan", "rowspan"],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "img", "a"],
};

export function sanitizeDocumentHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, { ...DOC_CONFIG, RETURN_TRUSTED_TYPE: false }) as string;
}

/** Lista as variáveis que ainda faltam preencher para um determinado modelo. */
export function missingVariables(html: string, values: Record<string, string>): string[] {
  const found = new Set<string>();
  (html || "").replace(/\{\{([A-Z_0-9]+)\}\}/g, (_m, key: string) => {
    if (key !== "DATA_ASSINATURA" && !(values[key] || "").trim()) found.add(key);
    return _m;
  });
  return [...found];
}

export function signerFieldLabel(key: string): string {
  return SIGNER_FIELDS.find((f) => f.key === key)?.label || key.replace(/_/g, " ").toLowerCase();
}

export interface OcrDocLike {
  ocr_kind?: string | null;
  ocr_data?: Record<string, string> | null;
}

/** Deriva os dados do signatário a partir do OCR dos documentos enviados (RG/CNH, CPF, comprovante). */
export function signerDataFromOcr(docs: OcrDocLike[]): Record<string, string> {
  const out: Record<string, string> = {};
  (docs || []).forEach((d) => {
    const o = d.ocr_data || {};
    if (d.ocr_kind === "id" || d.ocr_kind === "cpf") {
      if (o.nome) out.NOME_COMPLETO = o.nome;
      if (o.cpf) out.CPF = o.cpf;
      if (o.rg) out.RG = o.rg;
    }
    if (d.ocr_kind === "address") {
      if (o.logradouro) out.RUA = o.logradouro;
      if (o.numero) out.NUMERO = o.numero;
      if (o.bairro) out.BAIRRO = o.bairro;
      if (o.cidade) out.CIDADE = o.cidade;
      if (o.uf) out.ESTADO = o.uf;
    }
  });
  return out;
}
