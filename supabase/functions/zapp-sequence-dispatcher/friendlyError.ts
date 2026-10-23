/** Traduz erros técnicos do envio para frases que qualquer pessoa entende. */
export function friendlyError(raw: string, contentType?: string): string {
  // Já está em português simples (gravado pelo próprio envio): mantém
  if (/^(O |Esse |Muitas |Nenhum )/.test(raw || "")) return raw;
  const e = (raw || "").toLowerCase();
  const isFile = contentType && !["text", "link", "list", "template"].includes(contentType);
  if (isFile && (e.includes("timeout") || e.includes("failed to fetch url") || e.includes("failed to process file")))
    return "O WhatsApp não conseguiu baixar o arquivo a tempo. O arquivo pode estar grande demais — tente uma versão mais leve.";
  if (e.includes("timeout")) return "O WhatsApp demorou demais para responder. Tente enviar de novo.";
  if (e.includes("not on whatsapp") || e.includes("not exists") || e.includes("invalid number") || e.includes("número"))
    return "Esse número não tem WhatsApp ou está incorreto.";
  if (e.includes("disconnect") || e.includes("not connected") || e.includes("conexão") || e.includes("401") || e.includes("unauthorized"))
    return "O WhatsApp do setor está desconectado. Peça para reconectar e tente de novo.";
  if (e.includes("too large") || e.includes("413") || e.includes("size"))
    return "O arquivo é grande demais para o WhatsApp.";
  if (e.includes("rate") || e.includes("429")) return "Muitas mensagens em pouco tempo. Aguarde alguns minutos e tente de novo.";
  return "O WhatsApp não confirmou o envio desta mensagem. Tente enviar de novo.";
}
