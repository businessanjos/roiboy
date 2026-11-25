import { describe, expect, it } from "vitest";
import { MQL_PIPELINE_NAMES, NON_MQL_PIPELINE_NAMES, pickDefaultPipeline, pickPipelineByName } from "../../../supabase/functions/_shared/pipelineNames";

const row = (id: string, name: string, system_role: string | null = null, previous_names: string[] = []) => ({ id, name, system_role, previous_names });

describe("roteamento padrão não depende do nome do funil", () => {
  it("lead qualificado vai para o funil com papel de fechamento, com qualquer nome", () => {
    const rows = [row("sdr", "SDR", "sdr"), row("fech", "Vendas Premium 2027", "closer"), row("pass", "Entrada", "low_ticket")];
    expect(pickDefaultPipeline(rows, "closer", MQL_PIPELINE_NAMES)?.id).toBe("fech");
    expect(pickDefaultPipeline(rows, "low_ticket", NON_MQL_PIPELINE_NAMES)?.id).toBe("pass");
  });
  it("sem papel, usa o nome conhecido e depois o nome anterior", () => {
    expect(pickDefaultPipeline([row("a", "Funil Mentoria")], "closer", MQL_PIPELINE_NAMES)?.id).toBe("a");
    expect(pickDefaultPipeline([row("b", "Novo Nome", null, ["Closer"])], "closer", MQL_PIPELINE_NAMES)?.id).toBe("b");
    expect(pickDefaultPipeline([row("c", "Outro")], "closer", MQL_PIPELINE_NAMES)).toBeNull();
  });
  it("integração que envia o nome antigo chega no funil renomeado", () => {
    const rows = [row("m", "Funil Mentoria", "closer", ["Closer"]), row("s", "SDR", "sdr")];
    expect(pickPipelineByName(rows, "closer")?.id).toBe("m");
    expect(pickPipelineByName(rows, "Inexistente")).toBeNull();
  });
  it("nome atual vence nome anterior de outro funil", () => {
    const rows = [row("antigo", "Funil Mentoria", "closer", ["Closer"]), row("novo", "Closer")];
    expect(pickPipelineByName(rows, "Closer")?.id).toBe("novo");
  });
});
