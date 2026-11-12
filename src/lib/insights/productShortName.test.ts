import { describe, it, expect } from "vitest";
import { productShortName } from "./productShortName";
describe("productShortName", () => {
  it("venda nova usa a sigla do Item da Venda", () => {
    expect(productShortName("EM l Eternum Mentoring")).toBe("EM");
    expect(productShortName("RM l Rykas Mentoring")).toBe("RM");
  });
  it("renovação vira REN. + sigla", () => {
    expect(productShortName("REN. EM l Eternum Mentoring")).toBe("REN. EM");
    expect(productShortName("REN. RM l Rykas Mentoring")).toBe("REN. RM");
  });
});
