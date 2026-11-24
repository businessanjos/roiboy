import { describe, expect, it } from "vitest";
import { buildPipelineOrderChanges, movePipelineInOrder } from "../sales/pipelineOrder";

describe("Ordem dos funis", () => {
  const pipelines = [{ id: "a", display_order: 0 }, { id: "b", display_order: 4 }, { id: "c", display_order: 8 }];
  it("coloca os funis na ordem escolhida, reutilizando posições sem alterar funis ocultos", () => {
    expect(buildPipelineOrderChanges(pipelines, ["c", "a", "b"])).toEqual([
      { id: "c", display_order: 0, previous_order: 8 },
      { id: "a", display_order: 4, previous_order: 0 },
      { id: "b", display_order: 8, previous_order: 4 },
    ]);
  });
  it("não altera nada se a ordem já está salva", () => {
    expect(buildPipelineOrderChanges(pipelines, ["a", "b", "c"])).toEqual([]);
  });
  it.each([["a", "a", "c"], ["a", "b"], ["a", "b", "outro"]])("recusa lista duplicada, incompleta ou com funil desconhecido: %j", (...ids) => {
    expect(() => buildPipelineOrderChanges(pipelines, ids)).toThrow();
  });
  it("resolve posições antigas empatadas", () => {
    expect(buildPipelineOrderChanges([{ id: "a", display_order: 0 }, { id: "b", display_order: 0 }], ["b", "a"])).toEqual([{ id: "a", display_order: 1, previous_order: 0 }]);
  });
  it("sobe e desce sem passar das extremidades ou alterar a lista original", () => {
    const ids = ["a", "b", "c"];
    expect(movePipelineInOrder(ids, "b", -1)).toEqual(["b", "a", "c"]);
    expect(movePipelineInOrder(ids, "b", 1)).toEqual(["a", "c", "b"]);
    expect(movePipelineInOrder(ids, "a", -1)).toEqual(ids);
    expect(movePipelineInOrder(ids, "c", 1)).toEqual(ids);
    expect(movePipelineInOrder(ids, "outro", 1)).toEqual(ids);
    expect(ids).toEqual(["a", "b", "c"]);
  });
});