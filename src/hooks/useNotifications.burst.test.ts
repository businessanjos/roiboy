import { describe, expect, it } from "vitest";
import { notifyDecision } from "./useNotifications";

const NOW = new Date("2026-11-04T14:56:00Z").getTime();
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe("notifyDecision", () => {
  it("não interrompe para lote atrasado (mais de 25s)", () => {
    expect(notifyDecision(iso(40_000), NOW, 0)).toEqual({ stale: true, quiet: false });
  });

  it("interrompe para notificação recém-nascida", () => {
    expect(notifyDecision(iso(3_000), NOW, 0)).toEqual({ stale: false, quiet: false });
  });

  it("silencia a segunda de uma rajada no mesmo instante", () => {
    expect(notifyDecision(iso(1_000), NOW, NOW - 300)).toEqual({ stale: false, quiet: true });
  });

  it("deixa passar a próxima depois de 1,2s", () => {
    expect(notifyDecision(iso(1_000), NOW, NOW - 1_500)).toEqual({ stale: false, quiet: false });
  });

  it("não trava com data ausente", () => {
    expect(notifyDecision(null, NOW, 0)).toEqual({ stale: false, quiet: false });
  });
});
