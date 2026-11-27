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

/** Botões clicáveis: escolha de quem criou o template, marcada nos próprios botões. */
export const templateButtonsClickable = (buttons?: Btn[] | null): boolean =>
  !!buttons?.some((b) => (b as Record<string, unknown>).clickable === "1");

export function markButtonsClickable<T extends Btn>(buttons: T[], on: boolean): T[] {
  return buttons.map((b) => {
    const { clickable: _drop, ...rest } = b as T & { clickable?: string };
    return (on ? { ...rest, clickable: "1" } : rest) as T;
  });
}

export interface PlaybookMenu {
  /** Texto da mensagem, sem rodapé e sem a lista de botões. */
  text: string;
  footer: string;
  /** Opções no formato do WhatsApp ("Texto|destino"). */
  choices: string[];
  labels: string[];
  /** O que volta ao texto quando os botões não puderem ser enviados. */
  fallbackSuffix: string;
}

/**
 * Separa o template em mensagem + botões clicáveis. Devolve null quando o template
 * não pediu botões clicáveis ou o texto final não permite separar com segurança
 * (nesse caso a mensagem segue inteira como texto).
 */
export function templateMenu(item: PlaybookTextSource, processedFull: string): PlaybookMenu | null {
  if (item.content_type !== "template" || !templateButtonsClickable(item.template_buttons)) return null;
  const label = (b: Btn) => clean(b.text).replace(/\|/g, "/");
  const buttons = (item.template_buttons || [])
    .filter((b) => clean(b.text) && (b.type === "url" || b.type === "phone" ? clean(b.value) : true))
    .slice(0, 3);
  if (!buttons.length) return null;
  const tail = buttonsText(item.template_buttons || []);
  const full = (processedFull || "").trim();
  if (!tail || !full.endsWith(tail)) return null;
  let text = full.slice(0, full.length - tail.length).trimEnd();
  const footerRaw = clean(item.template_footer);
  let footer = "";
  if (footerRaw && text.endsWith(`_${footerRaw}_`)) {
    text = text.slice(0, text.length - footerRaw.length - 2).trimEnd();
    footer = footerRaw;
  }
  if (!text) return null;
  return {
    text,
    footer,
    labels: buttons.map(label),
    choices: buttons.map((b) => {
      if (b.type === "url") return `${label(b)}|${clean(b.value)}`;
      if (b.type === "phone") return `${label(b)}|call:${clean(b.value).replace(/[^\d+]/g, "")}`;
      return `${label(b)}|${label(b)}`;
    }),
    fallbackSuffix: full.slice(text.length),
  };
}
