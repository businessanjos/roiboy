import { describe, expect, it } from "vitest";
import {
  buildInternalCoreSet,
  clientRecordPhones,
  isInternalClientRecord,
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

describe("isInternalClientRecord", () => {
  const cores = buildInternalCoreSet([
    "+5543988741227", // Marketing | Eternum
    "+5543988346806", // Canal Consultor Apoio
    "+5511976461705", // Everton Pieri
  ]);

  it("marca cadastro cujo telefone principal é da equipe", () => {
    expect(isInternalClientRecord({ phone_e164: "+5543988741227" }, cores)).toBe(true);
    expect(isInternalClientRecord({ phone_e164: "+55 43 98874-1227" }, cores)).toBe(true);
  });

  it("marca cadastro que só esconde o número da equipe nos extras", () => {
    expect(
      isInternalClientRecord(
        { phone_e164: "+5554981410777", additional_phones: ["+5543988346806"] },
        cores,
      ),
    ).toBe(true);
  });

  it("não marca cliente real", () => {
    expect(
      isInternalClientRecord(
        { phone_e164: "+5554981410777", additional_phones: ["+5551992190330"] },
        cores,
      ),
    ).toBe(false);
    expect(isInternalClientRecord({ phone_e164: null }, cores)).toBe(false);
  });

  it("ignora extras que não são lista de telefones", () => {
    expect(
      isInternalClientRecord(
        { phone_e164: "+5554981410777", additional_phones: null },
        cores,
      ),
    ).toBe(false);
    expect(
      isInternalClientRecord(
        { phone_e164: "+5554981410777", additional_phones: { phone: "+5543988741227" } },
        cores,
      ),
    ).toBe(false);
  });

  it("lista o telefone principal mais os extras", () => {
    expect(
      clientRecordPhones({ phone_e164: "+5554981410777", additional_phones: ["+5551992190330"] }),
    ).toEqual(["+5554981410777", "+5551992190330"]);
  });
});
