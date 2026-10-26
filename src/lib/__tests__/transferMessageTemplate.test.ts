import { describe, expect, it } from "vitest";
import { renderTransferMessage, validateTransferTemplate } from "../transferMessageTemplate";

describe("transfer notice rendering shared by preview and sender", () => {
  const data = { tipo: "lead", vendedor: "Ana", lead: "TESTE QA", link: "https://iamroy.app/leads?lead=teste" };
  it("uses the edited private template", () => {
    expect(renderTransferMessage("private", "Olá {{vendedor}}: {{lead}}\n{{link}}", data)).toBe(`Olá Ana: TESTE QA\n${data.link}`);
  });
  it("keeps group and private templates independent", () => {
    expect(renderTransferMessage("group", "Equipe: {{vendedor}} / {{lead}}", data)).toBe("Equipe: Ana / TESTE QA");
  });
  it("omits whole lines whose optional data is missing", () => {
    expect(renderTransferMessage("private", "Lead {{lead}}\nFunil {{funil}}\nValor {{valor}}", data)).toBe("Lead TESTE QA");
  });
  it("uses the default when no template was saved", () => {
    expect(renderTransferMessage("private", null, data)).toContain(data.link);
  });
  it("rejects unknown placeholders and empty text", () => {
    expect(validateTransferTemplate("{{nao_existe}}")).not.toBeNull();
    expect(validateTransferTemplate(" ")).not.toBeNull();
    expect(validateTransferTemplate("{{vendedor}} {{link}}")).toBeNull();
  });
});