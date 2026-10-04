import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Home, Users, Stethoscope, Megaphone, Share2 } from "lucide-react";

const sectorState: { items: any[]; id: string } = { items: [], id: "operacoes" };
vi.mock("@/contexts/SectorContext", () => ({
  useSector: () => ({ currentSector: { id: sectorState.id, name: "Setor", navItems: sectorState.items } }),
}));
vi.mock("@/hooks/useSectorNavItems", () => ({ useSectorNavItems: () => sectorState.items }));
vi.mock("../Sidebar", () => ({ SidebarContent: () => <div>conteudo</div> }));
vi.mock("@/components/ui/roy-logo", () => ({ RoyLogo: () => null }));

import { MobileTabBar } from "../MobileTabBar";

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
  })) as any;
});

const renderAt = (url: string) =>
  render(<MemoryRouter initialEntries={[url]}><MobileTabBar /></MemoryRouter>);

describe("MobileTabBar", () => {
  it("no máximo 1 aria-current com query (content-hq?tab=redes)", () => {
    sectorState.items = [
      { to: "/marketing/content-hq", label: "Conteúdo", icon: Megaphone },
      { to: "/marketing/content-hq?tab=redes", label: "Social Media", icon: Share2 },
    ];
    const { container } = renderAt("/marketing/content-hq?tab=redes");
    const current = container.querySelectorAll('nav [aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain("Social Media");
  });

  it("rota filha fora dos atalhos não marca o pai (vai para Mais)", () => {
    sectorState.items = [
      { to: "/dashboard", label: "Painel", icon: Home },
      { to: "/clients", label: "Clientes", icon: Users },
      { to: "/a", label: "A", icon: Home },
      { to: "/b", label: "B", icon: Home },
      { to: "/clients/checkpoints", label: "Checkpoints", icon: Stethoscope },
    ];
    const { container } = renderAt("/clients/checkpoints");
    expect(container.querySelectorAll('nav [aria-current="page"]')).toHaveLength(0);
  });

  it("distribui colunas pelos destinos reais + Mais", () => {
    sectorState.items = [
      { to: "/x", label: "X", icon: Home },
      { to: "/y", label: "Y", icon: Home },
    ];
    const { container } = renderAt("/x");
    const ul = container.querySelector("nav ul") as HTMLElement;
    expect(ul.style.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
  });

  it("menu Mais tem botão Fechar menu", async () => {
    sectorState.items = [{ to: "/x", label: "X", icon: Home }];
    renderAt("/x");
    fireEvent.click(screen.getByRole("button", { name: "Mais opções do setor" }));
    expect(await screen.findByRole("button", { name: "Fechar menu" })).toBeTruthy();
  });
});
