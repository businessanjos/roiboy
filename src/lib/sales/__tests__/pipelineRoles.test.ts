import { describe, expect, it } from "vitest";
import { findPipelineByRole, hasPipelineRole, pipelineRenameNotice } from "../pipelineRoles";

describe("papel fixo do funil", () => {
  it("reconhece o funil pelo papel mesmo com qualquer nome", () => {
    const pipelines = [{ id: "a", name: "Pré-venda 2027", system_role: "sdr" }, { id: "b", name: "Fechamento", system_role: "closer" }];
    expect(findPipelineByRole(pipelines, "closer")?.id).toBe("b");
    expect(hasPipelineRole(pipelines[0], "sdr")).toBe(true);
    expect(hasPipelineRole(pipelines[0], "closer")).toBe(false);
  });
  it("um funil chamado SDR sem papel não toma o lugar do funil que tem o papel", () => {
    const pipelines = [{ id: "novo", name: "SDR", system_role: null }, { id: "real", name: "Pré-venda", system_role: "sdr" }];
    expect(findPipelineByRole(pipelines, "sdr")?.id).toBe("real");
  });
  it("sem papel gravado usa os nomes conhecidos como reserva", () => {
    expect(findPipelineByRole([{ id: "x", name: "Funil Mentoria" }], "closer")?.id).toBe("x");
    expect(findPipelineByRole([{ id: "x", name: "Outro" }], "closer")).toBeNull();
  });
});

describe("aviso antes de renomear", () => {
  it("informa quantos gráficos e painéis acompanham e o papel do funil", () => {
    const notice = pipelineRenameNotice("Closer", { charts: 4, dashboards: 2, system_role: "closer" });
    expect(notice.keeps).toContain("4 gráficos salvos em 2 painéis passam a usar o nome novo sozinhos.");
    expect(notice.keeps.some(line => line.includes("leads qualificados"))).toBe(true);
    expect(notice.keeps.some(line => line.includes('"Closer"'))).toBe(true);
    expect(notice.changes.some(line => line.includes("Central de Tráfego"))).toBe(true);
  });
  it("usa singular e não inventa papel", () => {
    const notice = pipelineRenameNotice("Teste", { charts: 1, dashboards: 1, system_role: null });
    expect(notice.keeps).toContain("1 gráfico salvo em 1 painel passa a usar o nome novo sozinhos.");
    expect(notice.keeps).toHaveLength(3);
  });
});
