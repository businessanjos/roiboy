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
