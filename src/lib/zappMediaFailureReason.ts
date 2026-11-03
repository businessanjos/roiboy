// Traduz o motivo técnico de falha de download em um aviso curto para a equipe.
export function zappMediaFailureReason(error?: string | null, mediaType?: string | null): string | null {
  if (!error) return null;
  const item = mediaType === "video" ? "Este vídeo" : "Este arquivo";
  if (/too large/i.test(error)) return `${item} é grande demais para abrir no ROY (acima de 64 MB). Peça ao cliente para enviar uma versão menor ou abra pelo celular.`;
  if (/authentication failed|decryption failed/i.test(error)) return `O WhatsApp entregou ${item.toLowerCase()} incompleto ou já expirado. Abra pelo celular ou peça ao cliente para reenviar.`;
  if (/n[aã]o recebida|missing media key/i.test(error)) return `O WhatsApp não enviou ${item.toLowerCase()} para o ROY. Abra pelo celular ou peça ao cliente para reenviar.`;
  if (/Download failed: (404|410|403)/i.test(error)) return `${item} expirou no WhatsApp e não pode mais ser baixado. Peça ao cliente para reenviar.`;
  if (/abort|timeout/i.test(error)) return `${item} demorou demais para baixar. Tente novamente em alguns minutos.`;
  return null;
}
