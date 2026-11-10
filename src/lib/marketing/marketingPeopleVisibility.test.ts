import { describe, expect, it } from "vitest";
import {
  filterMarketingPeople,
  isHiddenMarketingPerson,
} from "./marketingPeopleVisibility";

const LUCAS_SUPORTE_ID = "4385080f-e707-460f-b7ab-489fa3f73150";

describe("marketingPeopleVisibility", () => {
  it("esconde o Lucas Suporte pelo id cadastrado", () => {
    expect(isHiddenMarketingPerson({ id: LUCAS_SUPORTE_ID, name: "Lucas Suporte" })).toBe(true);
  });

  it("esconde o Lucas Suporte pelo nome, com caixa e acentos diferentes", () => {
    expect(isHiddenMarketingPerson({ id: "outro", name: "LUCAS   SUPORTE" })).toBe(true);
    expect(isHiddenMarketingPerson({ id: "outro", name: " lucas suporte " })).toBe(true);
  });

  it("mantém o Lucas dos Santos e as demais pessoas da equipe", () => {
    expect(isHiddenMarketingPerson({ id: "14389b62-d4a1-4837-9aee-61a19b28c383", name: "Lucas dos Santos" })).toBe(false);
    expect(isHiddenMarketingPerson({ id: "x", name: "Bruna Pieri" })).toBe(false);
    expect(isHiddenMarketingPerson({ id: "x", name: "Fernanda Ramalho" })).toBe(false);
    expect(isHiddenMarketingPerson(null)).toBe(false);
  });

  it("remove só o Lucas Suporte de uma lista de seleção", () => {
    const list = [
      { id: "a", name: "Bruna Pieri" },
      { id: LUCAS_SUPORTE_ID, name: "Lucas Suporte" },
      { id: "b", name: "Fernanda Ramalho" },
      { id: "c", name: "Lincoln Ricardo" },
    ];
    expect(filterMarketingPeople(list).map((u) => u.name)).toEqual([
      "Bruna Pieri",
      "Fernanda Ramalho",
      "Lincoln Ricardo",
    ]);
    expect(filterMarketingPeople(null)).toEqual([]);
  });
});
