import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { releaseTvs } = vi.hoisted(() => ({ releaseTvs: vi.fn(async () => {}) }));
vi.mock("@/hooks/useTvWall", () => ({ releaseTvs }));
vi.mock("../tvShared", () => ({ runTv: (fn: any) => fn() }));

import { ReleaseMenu } from "../TvConnRelease";

const screens = [
  { slot: 1, schedule_mode: "global" },
  { slot: 2, schedule_mode: "global" },
];
const settings = { off_time: "18:00" };

/** Abre o menu pelo teclado (o gatilho do Radix alterna no Enter). */
function openMenu(releasedSlots: number[]) {
  render(
    <ReleaseMenu screens={screens} settings={settings} releasedSlots={releasedSlots}>
      <button>gatilho</button>
    </ReleaseMenu>,
  );
  fireEvent.keyDown(screen.getByText("gatilho"), { key: "Enter" });
}

describe("menu Liberar todas", () => {
  beforeEach(() => releaseTvs.mockClear());

  it("mostra as 4 opções de tempo", () => {
    openMenu([]);
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("1 h")).toBeInTheDocument();
    expect(screen.getByText("2 h")).toBeInTheDocument();
    expect(screen.getByText(/^Até o fim do dia/)).toBeInTheDocument();
  });

  it("sem nenhuma TV liberada não aparece a linha de devolver", () => {
    openMenu([]);
    expect(screen.queryByText(/Devolver todas/)).toBeNull();
  });

  it("com TVs liberadas mostra devolver com a quantidade", () => {
    openMenu([1, 2]);
    expect(screen.getByText("Devolver todas (2)")).toBeInTheDocument();
  });

  it("clicar em devolver devolve as TVs liberadas (until = null)", () => {
    openMenu([1, 2]);
    fireEvent.click(screen.getByText("Devolver todas (2)"));
    expect(releaseTvs).toHaveBeenCalledWith([1, 2], null);
  });
});
