import { describe, expect, it } from "vitest";
import { playbookItemRawText } from "../playbookItemText";

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
