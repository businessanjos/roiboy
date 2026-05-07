import { useLocation, useNavigate } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const formatCnpj = (doc: string) => {
  const d = (doc || "").replace(/\D/g, "");
  if (d.length !== 14) return doc;
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

export function CompanySelector() {
  const location = useLocation();
  const navigate = useNavigate();
  const { companies, currentCompany, setCurrentCompanyId } = useCompany();

  // Only show on financial routes
  if (!location.pathname.startsWith("/financial")) return null;

  const label = currentCompany?.trade_name || currentCompany?.legal_name || "Selecionar empresa";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 max-w-[220px]">
          <Building2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs">Empresa emissora (CNPJ)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            Nenhuma empresa cadastrada.
          </div>
        ) : (
          companies.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onClick={() => setCurrentCompanyId(c.id)}
              className={cn("flex flex-col items-start gap-0.5", c.id === currentCompany?.id && "bg-accent")}
            >
              <span className="text-sm font-medium truncate w-full">
                {c.trade_name || c.legal_name}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {formatCnpj(c.document)}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/financial/empresas")}>
          <Plus className="mr-2 h-4 w-4" />
          Gerenciar empresas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
