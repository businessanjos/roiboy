export type TransferMessageChannel = "private" | "group";
export interface TransferMessageData {
  tipo: string;
  vendedor: string;
  negocio?: string;
  lead?: string;
  funil?: string;
  etapa?: string;
  valor?: string;
  origem?: string;
  transferido_por?: string;
  link: string;
}

export const TRANSFER_MESSAGE_VARIABLES = ["tipo", "vendedor", "negocio", "lead", "funil", "etapa", "valor", "origem", "transferido_por", "link"] as const;
const details = `📌 *Negócio:* {{negocio}}
👤 *Lead:* {{lead}}
🧭 *Funil:* {{funil}}
📍 *Etapa:* {{etapa}}
💰 *Valor:* {{valor}}
📣 *Origem:* {{origem}}
🔁 *Transferido por:* {{transferido_por}}

Abrir no ROY: {{link}}`;
export const DEFAULT_TRANSFER_TEMPLATES = {
  private: `🎯 *Novo {{tipo}} para você, {{vendedor}}!*\n\n${details}`,
  group: `🔔 *{{vendedor}}* recebeu um novo {{tipo}}\n\n${details}`,
};

export function validateTransferTemplate(text: string): string | null {
  if (!text.trim()) return "Escreva o texto da mensagem.";
  if (text.length > 4000) return "Use até 4.000 caracteres.";
  const unknown = [...text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].find((m) =>
    !TRANSFER_MESSAGE_VARIABLES.includes(m[1] as typeof TRANSFER_MESSAGE_VARIABLES[number]));
  return unknown ? `Variável desconhecida: {{${unknown[1]}}}` : null;
}

/** Used by both the editor preview and the actual sender. Missing optional fields omit their whole line. */
export function renderTransferMessage(channel: TransferMessageChannel, template: string | null | undefined, data: TransferMessageData): string {
  const source = template && !validateTransferTemplate(template) ? template : DEFAULT_TRANSFER_TEMPLATES[channel];
  const values: Record<string, string> = { ...data, vendedor: data.vendedor || "Vendedor" };
  return source.split("\n").filter((line) => {
    const keys = [...line.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((m) => m[1]);
    return keys.every((key) => !!values[key]);
  }).map((line) => line.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, key: string) => values[key] || ""))
    .join("\n").replace(/\n{3,}/g, "\n\n").trim();
}