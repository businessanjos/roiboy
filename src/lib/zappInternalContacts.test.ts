import { describe, expect, it } from "vitest";
import {
  buildInternalCoreSet,
  isInternalContactPhone,
  zappPhoneCore,
} from "./zappInternalContacts";

describe("zappPhoneCore", () => {
  it("reduz o número do time ao mesmo código do banco", () => {
    expect(zappPhoneCore("+5511983364308")).toBe("1183364308");
    expect(zappPhoneCore("+55 11 98336-4308")).toBe("1183364308");
    expect(zappPhoneCore("5511983364308")).toBe("1183364308");
  });

  it("devolve nulo quando não há número", () => {
    expect(zappPhoneCore(null)).toBeNull();
    expect(zappPhoneCore("")).toBeNull();
    expect(zappPhoneCore("abc")).toBeNull();
  });
});

describe("isInternalContactPhone", () => {
  const cores = buildInternalCoreSet([
    "+5511983364308",
    "+5543988310344",
    null,
    "",
  ]);

  it("reconhece o número registrado da equipe", () => {
    expect(isInternalContactPhone("+5511983364308", cores)).toBe(true);
    expect(isInternalContactPhone("11 98336-4308", cores)).toBe(true);
  });

  it("não marca cliente que não está registrado", () => {
    expect(isInternalContactPhone("+5554981410777", cores)).toBe(false);
    expect(isInternalContactPhone(null, cores)).toBe(false);
  });

  it("com conjunto vazio nada é interno", () => {
    expect(isInternalContactPhone("+5511983364308", new Set())).toBe(false);
  });
});
