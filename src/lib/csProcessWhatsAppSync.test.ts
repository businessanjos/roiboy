import { describe, it, expect } from "vitest";
import { detectOnboardingSteps } from "./csProcessWhatsAppSync";

describe("detectOnboardingSteps", () => {
  it("reconhece boas-vindas, acesso Ryka, cadastro e Meet enviados pela equipe", () => {
    const s = detectOnboardingSteps([
      { direction: "outbound", content: "Olá Leoni, seja bem-vinda ao Eternum Mentoring!" },
      { direction: "outbound", content: "Link https://rykasystem.com login: x senha: y" },
      { direction: "outbound", content: "Cadastro Empresarial: https://iamroy.app/f/f53653f9-85b3" },
      { direction: "outbound", content: "https://meet.google.com/abc-defg-hij" },
    ]);
    expect([...s].sort()).toEqual(["0-0", "0-1", "1-0", "2-0"]);
  });
  it("ignora mensagens da cliente", () => {
    expect(detectOnboardingSteps([{ direction: "inbound", content: "boas-vindas meet.google.com" }]).size).toBe(0);
  });
});
