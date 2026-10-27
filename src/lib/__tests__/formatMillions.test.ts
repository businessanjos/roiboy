import { describe, it, expect } from "vitest";
import { formatMillionsHint, formatAxisMillions } from "../formatMillions";

describe("formatMillions", () => {
  it("mostra milhões", () => {
    expect(formatMillionsHint(114342456)).toBe("≈ 114,3 mi");
    expect(formatAxisMillions(4500000)).toBe("4,5 mi");
  });
  it("mostra mil abaixo de 1 milhão", () => {
    expect(formatMillionsHint(538655)).toBe("≈ 538,7 mil");
  });
});
