import { useId } from "react";
import { Building2, X } from "lucide-react";
import type { Company } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props {
  companies: Company[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  className?: string;
}

export function CompanyFilter({ companies, value, onChange, loading, className }: Props) {
  const id = useId();
  return (
    <div className={cn("w-full min-w-0 space-y-1 sm:w-[220px]", className)}>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">Empresa</label>
      <div className="flex min-w-0 items-center gap-1">
        <Select value={value} onValueChange={onChange} disabled={loading}>
          <SelectTrigger id={id} aria-label="Filtrar por empresa" className={cn("min-h-11 min-w-0 gap-2 text-base sm:text-sm", value !== "all" && "border-primary/60 text-primary")}>
            <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-left"><SelectValue placeholder="Todas as empresas" /></span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="min-h-11">Todas as empresas</SelectItem>
            {companies.map((company) => <SelectItem key={company.id} value={company.id} className="min-h-11">{company.trade_name || company.legal_name}</SelectItem>)}
          </SelectContent>
        </Select>
        {value !== "all" && <Button variant="ghost" size="icon" className="h-11 w-9 shrink-0" onClick={() => onChange("all")} aria-label="Limpar filtro de empresa" title="Limpar filtro de empresa"><X className="h-4 w-4" /></Button>}
      </div>
    </div>
  );
}