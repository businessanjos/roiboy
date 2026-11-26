import { describe, expect, it } from "vitest";
import {
  canConfirmDelete,
  describeUsage,
  findNameConflict,
  validateAreaName,
} from "./changeImpact";

const areas = [
  { id: "1", label: "Facial" },
  { id: "2", label: "Micro/Nano pigmentação" },
  { id: "3", label: "Estética Íntima" },
];

describe("troca de nome da área de atuação", () => {
  it("recusa nome com vírgula, porque a vírgula separa as áreas na ficha", () => {
    expect(validateAreaName("Odontologia, estética")).toBe("O nome da área não pode ter vírgula");
    expect(validateAreaName("   ")).toBe("Informe um nome");
    expect(validateAreaName("Odontologia e estética")).toBeNull();
  });

  it("acusa nome repetido mesmo com maiúsculas e acentos diferentes", () => {
    expect(findNameConflict(areas, "1", "estetica intima")?.id).toBe("3");
    expect(findNameConflict(areas, "2", "FACIAL")?.id).toBe("1");
  });

  it("deixa corrigir a escrita da própria área", () => {
    expect(findNameConflict(areas, "1", "facial")).toBeNull();
    expect(findNameConflict(areas, "1", "Harmonização")).toBeNull();
  });
});

describe("exclusão da área de atuação", () => {
  it("área sem fichas pode ser excluída direto", () => {
    expect(canConfirmDelete({ clients: 0, leads: 0 }, null, null)).toBe(true);
  });

  it("área em uso exige destino ou confirmação de retirada", () => {
    const usage = { clients: 9, leads: 0 };
    expect(canConfirmDelete(usage, null, null)).toBe(false);
    expect(canConfirmDelete(usage, "move", null)).toBe(false);
    expect(canConfirmDelete(usage, "move", "1")).toBe(true);
    expect(canConfirmDelete(usage, "remove", null)).toBe(true);
  });

  it("descreve onde a área está em uso", () => {
    expect(describeUsage({ clients: 1, leads: 0 })).toBe("1 ficha de cliente");
    expect(describeUsage({ clients: 12, leads: 3 })).toBe("12 fichas de clientes e 3 leads");
    expect(describeUsage({ clients: 0, leads: 0 })).toBeNull();
  });
});
