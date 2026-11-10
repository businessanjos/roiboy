import { describe, it, expect } from "vitest";
import { csProcesses } from "@/lib/csProcesses";
import { toStepInfo, visibleActions } from "@/lib/csProcessActions";
import { applyArtVisibility, artTagOf, clientArtTags } from "@/lib/csProcessArtProducts";

/** Etapa 1.3 — Grupos de WhatsApp (mentoria): tem as duas artes do Canva, EM e EC. */
const step13 = csProcesses[0].phases[0].steps[2];
const artsOf = (names: string[]) => visibleActions(applyArtVisibility(toStepInfo(step13).actions, names))
  .filter((a) => a.kind === "link")
  .map((a: any) => a.label);

describe("arte do Canva conforme o produto da cliente", () => {
  it("a etapa 1.3 traz as artes EM e EC", () => {
    expect(artsOf([])).toEqual(["Abrir arte no Canva (EM)", "Abrir arte no Canva (EC)"]);
  });

  it("cliente com Eternum Mentoring vê só a arte do EM", () => {
    expect(artsOf(["EM l Eternum Mentoring"])).toEqual(["Abrir arte no Canva (EM)"]);
  });

  it("cliente com Eternum Club vê só a arte do EC", () => {
    expect(artsOf(["EC l Eternum Club"])).toEqual(["Abrir arte no Canva (EC)"]);
  });

  it("renovação conta como o mesmo produto", () => {
    expect(artsOf(["REN. EM l Eternum Mentoring"])).toEqual(["Abrir arte no Canva (EM)"]);
    expect(artsOf(["REN. EC l Eternum Club"])).toEqual(["Abrir arte no Canva (EC)"]);
  });

  it("cliente com os dois produtos vê as duas artes", () => {
    expect(artsOf(["EM l Eternum Mentoring", "EC l Eternum Club"])).toEqual([
      "Abrir arte no Canva (EM)",
      "Abrir arte no Canva (EC)",
    ]);
  });

  it("cliente sem Eternum Mentoring nem Club continua vendo as duas", () => {
    expect(artsOf(["RM l Rykas Mentoring"])).toEqual(["Abrir arte no Canva (EM)", "Abrir arte no Canva (EC)"]);
    expect(artsOf([])).toEqual(["Abrir arte no Canva (EM)", "Abrir arte no Canva (EC)"]);
  });

  it("esconder não muda a numeração dos passos", () => {
    const before = toStepInfo(step13).actions;
    const after = applyArtVisibility(before, ["EM l Eternum Mentoring"]);
    expect(after.length).toBe(before.length);
    expect(after.findIndex((a) => a.kind === "link")).toBe(before.findIndex((a) => a.kind === "link"));
  });
});

describe("leitura de produto e etiqueta", () => {
  it("reconhece a etiqueta da arte no rótulo", () => {
    expect(artTagOf("Abrir arte no Canva (EM)")).toBe("EM");
    expect(artTagOf("Abrir arte no Canva (EC)")).toBe("EC");
    expect(artTagOf("Abrir no Drive")).toBeNull();
  });

  it("mapeia o produto da cliente para a arte certa", () => {
    expect([...clientArtTags(["EM l Eternum Mentoring"])]).toEqual(["EM"]);
    expect([...clientArtTags(["EC l Eternum Club"])].sort()).toEqual(["EC"]);
    expect([...clientArtTags(["E-Pass l Eternum Pass", "Clinica Ryka"])]).toEqual([]);
  });
});
