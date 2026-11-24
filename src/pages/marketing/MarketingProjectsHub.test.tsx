import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MarketingProjectsHub from "./MarketingProjectsHub";

const views = vi.hoisted(() => ({ tasks: vi.fn(() => null), projects: vi.fn(() => null), rebranding: vi.fn(() => null) }));
vi.mock("@/pages/MarketingTasks", () => ({ default: views.tasks }));
vi.mock("@/pages/marketing/MarketingProjects", () => ({ default: views.projects }));
vi.mock("@/pages/marketing/Rebranding", () => ({ default: views.rebranding }));

beforeEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Abertura de Projetos & Tarefas", () => {
  it.each(["/marketing/projetos", "/marketing/projetos?tab=inexistente"])("abre Tarefas por padrão em %s, sem carregar Projetos ou Rebranding", async (path) => {
    render(<MemoryRouter initialEntries={[path]}><MarketingProjectsHub /></MemoryRouter>);
    await waitFor(() => expect(views.tasks).toHaveBeenCalled());
    expect(views.projects).not.toHaveBeenCalled();
    expect(views.rebranding).not.toHaveBeenCalled();
  });
  it.each(["projetos", "rebranding"])("preserva o link direto para %s", async (tab) => {
    render(<MemoryRouter initialEntries={[`/marketing/projetos?tab=${tab}`]}><MarketingProjectsHub /></MemoryRouter>);
    await waitFor(() => expect(tab === "projetos" ? views.projects : views.rebranding).toHaveBeenCalled());
    expect(views.tasks).not.toHaveBeenCalled();
  });
});