import { describe, expect, it } from "vitest";
import { genderConsultant } from "./consultantGender";
import { fillVars } from "./csProcessActions";
import { processVars } from "./csClientLinks";

describe("nome e tratamento do usuário logado nos processos", () => {
  it("substitui pelo primeiro nome de qualquer usuário e preserva a variável ao usar Consultor", () => {
    const source = "Eu sou {Nome da consultora}, Consultora aqui do Eternum.";
    const shown = genderConsultant(source, "Lucas dos Santos");
    const vars = processVars(null, null, "Lucas dos Santos");

    expect(shown).toBe("Eu sou {Nome da consultora}, Consultor aqui do Eternum.");
    expect(fillVars(shown, vars)).toBe("Eu sou Lucas, Consultor aqui do Eternum.");
  });

  it("mantém Consultora para usuárias", () => {
    const source = "Eu sou {Nome da consultora}, Consultora aqui do Eternum.";
    const shown = genderConsultant(source, "Andreia Barros");
    const vars = processVars(null, null, "Andreia Barros");

    expect(fillVars(shown, vars)).toBe("Eu sou Andreia, Consultora aqui do Eternum.");
  });
});

import { genderClient } from "./consultantGender";
describe("tratamento da cliente", () => {
  const src = "Seja muito bem-vinda agora membra do **Eternum Mentoring**.";
  it("cliente homem vira membro e bem-vindo", () => {
    expect(genderClient(src, "Thiago Caldeira")).toBe("Seja muito bem-vindo agora membro do **Eternum Mentoring**.");
  });
  it("cliente mulher continua membra", () => {
    expect(genderClient(src, "Leoni Santos")).toBe(src);
  });
  it("sócio do Club para homem", () => {
    expect(genderClient("cliente sócia do Eternum Club", "Thiago")).toBe("cliente sócio do Eternum Club");
  });
});
