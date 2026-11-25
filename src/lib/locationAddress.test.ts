import { describe, expect, it } from "vitest";
import { formatSimpleAddress, rankLocationResults, type NominatimResult } from "./locationAddress";

const result = (id: number, address: NominatimResult["address"]): NominatimResult => ({
  place_id: id,
  display_name: "x",
  lat: "0",
  lon: "0",
  address,
});

const mt = { state: "Mato Grosso", country: "Brasil" };

describe("endereço do campo de localização", () => {
  it("mostra a cidade do interior junto do estado", () => {
    expect(formatSimpleAddress(result(1, { town: "Peixoto de Azevedo", ...mt }))).toBe(
      "Peixoto de Azevedo, Mato Grosso, Brasil",
    );
  });

  it("traz primeiro a cidade digitada e não repete opções", () => {
    const ranked = rankLocationResults(
      [
        result(1, { town: "Terra Nova do Norte", ...mt }),
        result(2, { town: "Matupá", ...mt }),
        result(3, { town: "Matupá", ...mt }),
        result(4, { town: "Peixoto de Azevedo", ...mt }),
      ],
      "peixoto azevedo",
    );
    expect(ranked.map(formatSimpleAddress)).toEqual([
      "Peixoto de Azevedo, Mato Grosso, Brasil",
      "Terra Nova do Norte, Mato Grosso, Brasil",
      "Matupá, Mato Grosso, Brasil",
    ]);
  });
});
