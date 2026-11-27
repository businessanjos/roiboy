import { describe, expect, it } from "vitest";
import { markButtonsClickable, playbookItemRawText, templateButtonsClickable, templateMenu } from "../playbookItemText";

describe("playbookItemRawText", () => {
  it("template sem text_content vira mensagem com cabeçalho, corpo, rodapé e botões", () => {
    const text = playbookItemRawText({
      content_type: "template", text_content: null,
      template_header: "REATIVAÇÃO PROG. CR", template_body: "Hellou!", template_footer: "Equipe",
      template_buttons: [{ type: "quick_reply", text: "EU QUERO", value: "" }, { type: "quick_reply", text: "BLOQUEAR CONTATO" }],
    });
    expect(text).toBe("*REATIVAÇÃO PROG. CR*\n\nHellou!\n\n_Equipe_\n\n👉 Responda com uma das opções:\n• *EU QUERO*\n• *BLOQUEAR CONTATO*");
  });

  it("um único botão de resposta e botões de link/telefone", () => {
    const text = playbookItemRawText({
      content_type: "template", template_body: "Oi",
      template_buttons: [
        { type: "quick_reply", text: "EU QUERO" },
        { type: "url", text: "Site", value: "https://iamroy.app" },
        { type: "phone", text: "Ligar", value: "+5511999999999" },
        { type: "url", text: "Sem link", value: "" },
      ],
    });
    expect(text).toBe("Oi\n\n👉 Responda *EU QUERO*\n🔗 Site: https://iamroy.app\n📞 Ligar: +5511999999999");
  });

  it("lista sem text_content vira texto com as opções", () => {
    expect(playbookItemRawText({ content_type: "list", list_items: [{ title: "Plano A", description: "mensal" }, { title: "Plano B" }, { title: " " }] }))
      .toBe("• *Plano A* — mensal\n• *Plano B*");
  });

  it("texto comum continua igual", () => {
    expect(playbookItemRawText({ content_type: "text", text_content: " Olá " })).toBe("Olá");
  });
});

describe("templateMenu (botões clicáveis)", () => {
  const base = {
    content_type: "template", template_header: "Novidade", template_body: "Oi {{nome}}", template_footer: "Equipe",
    template_buttons: [
      { type: "quick_reply", text: "EU QUERO" },
      { type: "url", text: "Site", value: "https://iamroy.app" },
      { type: "phone", text: "Ligar", value: "+55 (11) 99999-9999" },
    ],
  };

  it("sem a opção ligada, o template segue como texto", () => {
    expect(templateButtonsClickable(base.template_buttons)).toBe(false);
    expect(templateMenu(base, playbookItemRawText(base))).toBeNull();
  });

  it("com a opção ligada separa mensagem, rodapé e botões, e o texto volta inteiro se os botões falharem", () => {
    const item = { ...base, template_buttons: markButtonsClickable(base.template_buttons, true) };
    const full = playbookItemRawText(item).replace("{{nome}}", "Ana");
    const menu = templateMenu(item, full)!;
    expect(menu.text).toBe("*Novidade*\n\nOi Ana");
    expect(menu.footer).toBe("Equipe");
    expect(menu.labels).toEqual(["EU QUERO", "Site", "Ligar"]);
    expect(menu.choices).toEqual(["EU QUERO|EU QUERO", "Site|https://iamroy.app", "Ligar|call:+5511999999999"]);
    expect(menu.text + menu.fallbackSuffix).toBe(full);
  });

  it("desligar a opção remove a marca dos botões", () => {
    const on = markButtonsClickable(base.template_buttons, true);
    expect(templateButtonsClickable(markButtonsClickable(on, false))).toBe(false);
  });
});
