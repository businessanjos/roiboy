import { describe, expect, it } from "vitest";
import { formatEducationName } from "../educationOptions";

describe("nomes de formação criados pelo usuário", () => {
  it("sempre começa com maiúscula, inclusive com acento", () => {
    expect(formatEducationName("  estética avançada  ")).toBe("Estética avançada");
  });

  it("preserva o nome próprio informado sem convertê-lo em outra formação", () => {
    expect(formatEducationName("medicina integrativa ABC")).toBe("Medicina integrativa ABC");
  });
});