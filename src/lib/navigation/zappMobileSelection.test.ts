import { describe, expect, it } from "vitest";
import { resolveZappHistorySelection, zappSelectionHistoryStates } from "./zappMobileSelection";

/** Simulates RoyZapp's mobile effect: applies history once per entry key. */
function makeSim() {
  let applied: string | null = null;
  let selected: string | null = null;
  const run = (key: string, state: any, ids: string[]) => {
    const a = resolveZappHistorySelection(key, state, applied, ids);
    if (a.type === "select") { selected = a.id; applied = key; }
    else if (a.type === "list") { selected = null; applied = key; }
    else if (a.type === "none") applied = key;
  };
  return { run, open: (id: string) => { selected = id; }, get selected() { return selected; } };
}

describe("seleção mobile do RoyZapp", () => {
  const ids = ["A", "B"];
  it("lista → A → notificação B → atualização de assignments mantém B", () => {
    const s = makeSim();
    s.run("k1", { zappList: true }, ids);
    s.run("k2", { zappSelection: "A" }, ids);
    expect(s.selected).toBe("A");
    s.open("B"); // abertura programática sem nova entrada
    s.run("k2", { zappSelection: "A" }, [...ids, "C"]); // realtime
    expect(s.selected).toBe("B");
  });

  it("lista após Voltar → notificação B → atualização mantém B", () => {
    const s = makeSim();
    s.run("k1", { zappList: true }, ids);
    s.open("B");
    s.run("k1", { zappList: true }, ids);
    expect(s.selected).toBe("B");
  });

  it("Voltar/Avançar restauram lista e conversa", () => {
    const s = makeSim();
    s.run("k2", { zappSelection: "A" }, ids);
    s.run("k1", { zappList: true }, ids);
    expect(s.selected).toBeNull();
    s.run("k2b", { zappSelection: "A" }, ids);
    expect(s.selected).toBe("A");
  });

  it("aguarda assignments carregarem antes de aplicar a seleção", () => {
    const s = makeSim();
    s.run("k2", { zappSelection: "A" }, []);
    expect(s.selected).toBeNull();
    s.run("k2", { zappSelection: "A" }, ids);
    expect(s.selected).toBe("A");
  });

  it("estados de histórico apontam lista e seleção", () => {
    const { listEntry, selectionEntry } = zappSelectionHistoryStates({ x: 1 }, "B");
    expect(listEntry).toMatchObject({ x: 1, zappList: true, zappSelection: undefined });
    expect(selectionEntry).toMatchObject({ x: 1, zappList: false, zappSelection: "B" });
  });
});
