import { describe, expect, it } from "vitest";
import { matchingTaskMentionPeople } from "./TaskMentions";

describe("Identificar pessoas em @menções", () => {
  it("pesquisa sem acento e mantém IDs diferentes para primeiros nomes iguais", () => {
    const people = [
      { id: "one", name: "Fernanda Ramos", avatar_url: null },
      { id: "two", name: "Fernanda Silva", avatar_url: null },
      { id: "three", name: "Jéssica Campos", avatar_url: null },
    ];
    expect(matchingTaskMentionPeople(people, "fernanda").map((person) => person.id)).toEqual(["one", "two"]);
    expect(matchingTaskMentionPeople(people, "jessica").map((person) => person.id)).toEqual(["three"]);
    expect(matchingTaskMentionPeople(people, "fora")).toEqual([]);
  });
});