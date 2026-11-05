import { describe, it, expect } from "vitest";
import { extractFirstName } from "./zappFirstNameTitle";

describe("extractFirstName", () => {
  it("mantém o título por padrão", () => {
    expect(extractFirstName("Dra. Juliana Ribeiro")).toBe("Dra. Juliana");
    expect(extractFirstName("Dr Roberto Silva")).toBe("Dr Roberto");
    expect(extractFirstName("Doutora Ana Lima")).toBe("Doutora Ana");
    expect(extractFirstName("doutor Paulo")).toBe("doutor Paulo");
  });
  it("tira o título quando desligado", () => {
    expect(extractFirstName("Dra. Juliana Ribeiro", false)).toBe("Juliana");
    expect(extractFirstName("Doutor Paulo Souza", false)).toBe("Paulo");
  });
  it("nomes sem título não mudam", () => {
    expect(extractFirstName("Lucas dos Santos")).toBe("Lucas");
    expect(extractFirstName("Lucas dos Santos", false)).toBe("Lucas");
    expect(extractFirstName("Drauzio Varella")).toBe("Drauzio");
  });
});
