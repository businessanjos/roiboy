import { Outlet } from "react-router-dom";
import { RykaScope } from "./RykaScope";

/** Layout de rota: aplica o tema Ryka em todas as telas da área de Vendas. */
export default function SalesThemeLayout() {
  return (
    <RykaScope className="min-h-[calc(100vh-4rem)]">
      <Outlet />
    </RykaScope>
  );
}
