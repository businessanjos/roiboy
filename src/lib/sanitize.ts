import DOMPurify from "dompurify";

/**
 * Configuração padrão para sanitização de HTML
 * Permite apenas tags seguras para formatação de texto
 */
const DEFAULT_HTML_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'code', 'del', 'br', 'span'],
  ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
};

/**
 * Sanitiza HTML permitindo apenas tags seguras
 * Use quando precisar renderizar HTML com formatação
 */
export function sanitizeHTML(html: string, options?: Record<string, unknown>): string {
  if (!html) return "";
  const result = DOMPurify.sanitize(html, {
    ...DEFAULT_HTML_CONFIG,
    ...options,
    RETURN_TRUSTED_TYPE: false,
  });
  return result as string;
}

/**
 * Remove todas as tags HTML, retornando apenas texto puro
 * Use para inputs que não devem conter HTML
 */
export function sanitizePlainText(text: string): string {
  if (!text) return "";
  const result = DOMPurify.sanitize(text, { ALLOWED_TAGS: [], RETURN_TRUSTED_TYPE: false });
  return result as string;
}

/**
 * Sanitiza string removendo caracteres potencialmente perigosos
 * Use para validação de entrada de formulários
 */
export function sanitizeInput(input: string): string {
  if (!input) return "";
  return input
    .replace(/[<>'"]/g, "") // Remove caracteres perigosos para HTML/SQL
    .replace(/javascript:/gi, "") // Remove URLs JavaScript
    .replace(/data:/gi, "") // Remove data URIs
    .replace(/on\w+\s*=/gi, "") // Remove event handlers (onclick=, onerror=, etc.)
    .replace(/vbscript:/gi, "") // Remove VBScript
    .replace(/expression\s*\(/gi, "") // Remove CSS expressions
    .trim();
}

/**
 * Sanitiza objeto recursivamente
 * Aplica sanitizeInput em todas as strings do objeto
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === "string") {
      (result as Record<string, unknown>)[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = value.map((item) =>
        typeof item === "string"
          ? sanitizeInput(item)
          : typeof item === "object" && item !== null
          ? sanitizeObject(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === "object" && value !== null) {
      (result as Record<string, unknown>)[key] = sanitizeObject(
        value as Record<string, unknown>
      );
    }
  }
  return result;
}

/**
 * Escapa caracteres HTML especiais
 * Use quando precisar exibir texto que pode conter HTML sem renderizá-lo
 */
export function escapeHTML(text: string): string {
  if (!text) return "";
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

/**
 * Valida e limita o tamanho de uma string
 */
export function limitString(input: string, maxLength: number): string {
  if (!input) return "";
  return input.substring(0, maxLength);
}
