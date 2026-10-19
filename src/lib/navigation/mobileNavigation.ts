import { pickActiveNavIndex } from "./activeNav";

export function hasAppHistory(index: unknown): boolean {
  return typeof index === "number" && index > 0;
}

export function mobileRouteContext(
  items: Array<{ to: string; label: string }>, pathname: string, search: string,
) {
  const global = [
    ["/settings", "Configurações"], ["/notifications", "Notificações"],
    ["/tasks", "Tarefas"], ["/setores", "Áreas"], ["/reuniao-lideres", "Reunião de Líderes"],
  ].find(([path]) => pathname === path || pathname.startsWith(path + "/"));
  const item = items[pickActiveNavIndex(items.map((i) => i.to), pathname, search)];
  if (global) return { title: global[1], parent: null };
  if (!item) return { title: "Detalhes", parent: null };
  const base = item.to.split("?")[0];
  if (pathname === base) return { title: item.label, parent: null };
  const titles: Record<string, string> = {
    "/clients": "Ficha do cliente", "/events": "Detalhes do evento",
    "/rh/collaborators": "Ficha do colaborador", "/marketing/projetos": "Detalhes do projeto",
    "/leads": "Ficha do lead", "/pipeline": "Detalhes do negócio",
  };
  return { title: titles[base] || `Detalhes · ${item.label}`, parent: item };
}

export function navigationScrollTop(action: string, saved: number | undefined): number | null {
  if (action === "POP") return saved ?? 0;
  // Query changes in the same history entry are filters, not new screens.
  if (action === "REPLACE") return null;
  return 0;
}

export function matchesScreenSearch(label: string, group: string, query: string): boolean {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalize(`${label} ${group}`).includes(normalize(query.trim()));
}