import { describe, it, expect } from "vitest";
import { filterSlashOptions, type SlashOption } from "../ZappMessageInput";

const opts: SlashOption[] = [
  { id: "1", label: "Formulário Inicial", kind: "sequence" },
  { id: "2", label: "Login Clínica Ryka", kind: "item" },
  { id: "3", label: "Blog do login", kind: "item" },
];

describe("filterSlashOptions", () => {
  it("/log sugere Login primeiro", () => {
    expect(filterSlashOptions(opts, "log").map((o) => o.id)).toEqual(["2", "3"]);
  });
  it("ignora acentos", () => {
    expect(filterSlashOptions(opts, "formulario").map((o) => o.id)).toEqual(["1"]);
  });
});
