import { describe, expect, it } from "vitest";
import {
  buildPracticeAreaOptions,
  displayPracticeArea,
  practiceAreaKey,
  practiceAreaMatches,
  splitPracticeAreas,
  PRACTICE_AREA_NONE,
} from "./clientPracticeArea";

describe("splitPracticeAreas", () => {
  it("separa a string salva em áreas individuais", () => {
    expect(splitPracticeAreas("Corporal, Emagrecimento , ")).toEqual(["Corporal", "Emagrecimento"]);
  });

  it("devolve lista vazia quando nada foi informado", () => {
    expect(splitPracticeAreas(null)).toEqual([]);
    expect(splitPracticeAreas("   ")).toEqual([]);
  });
});

describe("practiceAreaKey", () => {
  it("ignora caixa e acentos ao agrupar", () => {
    expect(practiceAreaKey("INJETÁVEIS")).toBe(practiceAreaKey("injetaveis"));
  });
});

describe("displayPracticeArea", () => {
  it("ajusta só a capitalização de siglas em caixa alta", () => {
    expect(displayPracticeArea("FACIAL")).toBe("Facial");
  });

  it("mantém a escrita escolhida pelo usuário", () => {
    expect(displayPracticeArea("Micro/Nano pigmentação")).toBe("Micro/Nano pigmentação");
  });
});

describe("buildPracticeAreaOptions", () => {
  it("conta o cliente em cada área que ele tem", () => {
    const options = buildPracticeAreaOptions(["Facial, Injetáveis", "facial", ""]);
    expect(options.find((o) => o.label === "Facial")?.count).toBe(2);
    expect(options.find((o) => o.label === "Injetáveis")?.count).toBe(1);
    expect(options.find((o) => o.value === PRACTICE_AREA_NONE)?.count).toBe(1);
  });

  it("não conta duas vezes a mesma área repetida no mesmo cliente", () => {
    const options = buildPracticeAreaOptions(["Facial, facial, FACIAL"]);
    expect(options).toHaveLength(1);
    expect(options[0].count).toBe(1);
  });

  it("ordena da área mais comum para a menos comum", () => {
    const options = buildPracticeAreaOptions(["Botox", "Facial, Corporal", "Facial"]);
    expect(options.map((o) => o.label)).toEqual(["Facial", "Botox", "Corporal"]);
  });
});

describe("practiceAreaMatches", () => {
  it("encontra a área mesmo com caixa ou acento diferentes", () => {
    expect(practiceAreaMatches("Corporal, Facial", practiceAreaKey("facial"))).toBe(true);
    expect(practiceAreaMatches("Corporal, Emagrecimento", practiceAreaKey("Facial"))).toBe(false);
  });

  it("trata o filtro de 'sem área' como o cliente sem nenhuma", () => {
    expect(practiceAreaMatches("", PRACTICE_AREA_NONE)).toBe(true);
    expect(practiceAreaMatches("Facial", PRACTICE_AREA_NONE)).toBe(false);
  });
});
