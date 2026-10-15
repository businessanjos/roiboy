import { describe, it, expect } from "vitest";
import { personalUnread } from "@/hooks/useZappPersonalGroupReads";

describe("leitura individual nos grupos", () => {
  it("quem já leu vê zero mesmo com não lidas dos colegas", () => {
    expect(personalUnread(5, { count: 0, raw: 5 })).toBe(0);
  });
  it("quem ainda não leu continua vendo as não lidas", () => {
    expect(personalUnread(5)).toBe(5);
  });
  it("mensagem nova depois da minha leitura volta a contar", () => {
    expect(personalUnread(7, { count: 0, raw: 5 })).toBe(2);
  });
});
