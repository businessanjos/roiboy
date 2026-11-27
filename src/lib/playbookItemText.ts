/**
 * Texto que o cliente recebe para itens do Playbook que viram mensagem de texto.
 * Template e Lista guardam o conteúdo fora de `text_content`, então o texto é
 * montado aqui (cabeçalho, corpo, rodapé e botões como chamadas de resposta).
 */
type Btn = { type?: string; text?: string; value?: string };
export interface PlaybookTextSource {
  content_type: string;
  text_content?: string | null;
  list_items?: { title?: string; description?: string }[] | null;
  template_header?: string | null;
  template_body?: string | null;
  template_footer?: string | null;
  template_buttons?: Btn[] | null;
}

const clean = (v?: string | null) => (v || "").trim();

function buttonsText(buttons: Btn[]): string {
  const valid = buttons.filter((b) => clean(b.text));
  const replies = valid.filter((b) => b.type !== "url" && b.type !== "phone");
  const lines: string[] = [];
  if (replies.length === 1) lines.push(`👉 Responda *${clean(replies[0].text)}*`);
  else if (replies.length > 1) {
    lines.push("👉 Responda com uma das opções:");
    replies.forEach((b) => lines.push(`• *${clean(b.text)}*`));
  }
  valid.forEach((b) => {
    const value = clean(b.value);
    if (b.type === "url") lines.push(value ? `🔗 ${clean(b.text)}: ${value}` : "");
    if (b.type === "phone") lines.push(value ? `📞 ${clean(b.text)}: ${value}` : "");
  });
  return lines.filter(Boolean).join("\n");
}

export function playbookItemRawText(item: PlaybookTextSource): string {
  if (item.content_type === "template") {
    const header = clean(item.template_header);
    const footer = clean(item.template_footer);
    return [
      header ? `*${header}*` : "",
      clean(item.template_body),
      footer ? `_${footer}_` : "",
      buttonsText(item.template_buttons || []),
    ].filter(Boolean).join("\n\n");
  }
  if (item.content_type === "list") {
    const rows = (item.list_items || [])
      .filter((r) => clean(r.title))
      .map((r) => (clean(r.description) ? `• *${clean(r.title)}* — ${clean(r.description)}` : `• *${clean(r.title)}*`));
    return [clean(item.text_content), rows.join("\n")].filter(Boolean).join("\n\n");
  }
  return clean(item.text_content);
}
