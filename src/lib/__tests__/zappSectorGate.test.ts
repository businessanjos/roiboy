import { describe, expect, it } from "vitest";
import { zappSectorGateMessage } from "../navigation/zappSectorGate";

describe("zappSectorGateMessage", () => {
  it("avisa para escolher o setor quando a tela exige um WhatsApp", () => {
    expect(
      zappSectorGateMessage({
        pathname: "/roy-zapp",
        search: "?view=tags",
        hasOpenableSector: true,
      })
    ).toBe("Selecione o setor desejado");
  });

  it("não avisa quando já existe um setor selecionado na URL", () => {
    expect(
      zappSectorGateMessage({
        pathname: "/roy-zapp",
        search: "?view=team&sector=vendas",
        hasOpenableSector: true,
      })
    ).toBeNull();
  });

  it("vale também na tela de atendimentos", () => {
    expect(
      zappSectorGateMessage({
        pathname: "/roy-zapp/atendimentos",
        search: "?view=analytics",
        hasOpenableSector: true,
      })
    ).toBe("Selecione o setor desejado");
  });

  it("muda o aviso quando nenhuma pessoa tem WhatsApp liberado", () => {
    expect(
      zappSectorGateMessage({
        pathname: "/roy-zapp",
        search: "",
        hasOpenableSector: false,
      })
    ).toBe("Nenhum WhatsApp liberado para o seu usuário");
  });

  it("não interfere fora do ROY zAPP", () => {
    expect(
      zappSectorGateMessage({
        pathname: "/clients",
        search: "",
        hasOpenableSector: true,
      })
    ).toBeNull();
  });
});
