import { isClientDetailRoute } from "./clientRoutes";

/** Shared route classification; authorization remains in the existing menus/pages. */
export function getSpecializedMenu(pathname: string) {
  if (pathname === "/settings") return { kind: "settings", title: "Configurações" } as const;
  if (pathname === "/admin") return { kind: "admin", title: "Administração" } as const;
  if (isClientDetailRoute(pathname)) return { kind: "client", title: "Ficha do cliente" } as const;
  return null;
}