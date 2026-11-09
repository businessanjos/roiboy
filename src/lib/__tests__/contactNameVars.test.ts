import { describe, it, expect } from "vitest";
import { dropEmptyNameToken, realContactName } from "@/lib/contactNameVars";

describe("contactNameVars", () => {
  it("Desconhecido nunca vira nome", () => {
    expect(realContactName("Desconhecido")).toBe("");
    expect(realContactName("+55 14 99744-0126")).toBe("");
    expect(realContactName("Yasmin Pastori")).toBe("Yasmin Pastori");
  });
  it("remove o nome vazio sem deixar vírgula solta", () => {
    expect(dropEmptyNameToken("Bom dia, {{primeiro_nome}}!", "{{primeiro_nome}}")).toBe("Bom dia!");
    expect(dropEmptyNameToken("Olá {{primeiro_nome}}, tudo bem?", "{{primeiro_nome}}")).toBe("Olá, tudo bem?");
  });
});
