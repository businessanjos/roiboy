import { Building2, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFinancialCompany } from "@/contexts/FinancialCompanyContext";

function formatCnpj(cnpj?: string | null) {
  if (!cnpj) return "";
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function CompanySelector({ compact = false }: { compact?: boolean }) {
  const { companies, selectedId, setSelectedId, loading } = useFinancialCompany();

  if (loading) {
    return <div className="h-9 w-64 rounded-md bg-muted animate-pulse" />;
  }

  if (companies.length === 0) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link to="/financial/integracoes/omie">
          <Plus className="h-4 w-4 mr-1" /> Adicionar CNPJ
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedId || ""} onValueChange={(v) => setSelectedId(v)}>
        <SelectTrigger className={compact ? "h-9 w-[260px]" : "h-9 w-[320px]"}>
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Selecionar CNPJ" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: c.color || "#3b82f6" }}
                />
                <span className="truncate">
                  {c.trade_name || c.legal_name || formatCnpj(c.cnpj) || "Sem nome"}
                </span>
                {c.is_default && (
                  <Badge variant="outline" className="text-[10px] py-0 px-1 ml-1">
                    padrão
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
