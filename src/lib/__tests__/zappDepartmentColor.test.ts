import { describe, it, expect } from "vitest";
import { getDepartmentColor } from "@/lib/zappDepartmentColor";

describe("cor dos departamentos", () => {
  it("traduz os nomes cadastrados em cor visível", () => {
    expect(getDepartmentColor("emerald")).toBe("hsl(152 55% 45%)");
    expect(getDepartmentColor("primary")).toBe("hsl(39 60% 55%)");
    expect(getDepartmentColor("amber")).toBe("hsl(39 60% 55%)");
  });

  it("aceita cor já pronta em CSS", () => {
    expect(getDepartmentColor("#10b981")).toBe("#10b981");
    expect(getDepartmentColor("hsl(217 91% 60%)")).toBe("hsl(217 91% 60%)");
  });

  it("nunca devolve vazio: sem cor usa o destaque do app", () => {
    expect(getDepartmentColor("")).toBe("hsl(var(--zapp-accent))");
    expect(getDepartmentColor(null)).toBe("hsl(var(--zapp-accent))");
    expect(getDepartmentColor("nome-inexistente")).toBe("hsl(var(--zapp-accent))");
  });
});
