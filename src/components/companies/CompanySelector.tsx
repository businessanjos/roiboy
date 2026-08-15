import { Building2 } from "lucide-react";
import { ALL_COMPANIES, useCompany } from "@/contexts/CompanyContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CompanySelectorProps {
  className?: string;
  /** Mostra a opção "Todas as empresas" (consolidado). */
  allowAll?: boolean;
}

export function CompanySelector({ className, allowAll = true }: CompanySelectorProps) {
  const { companies, currentCompanyId, setCurrentCompanyId } = useCompany();

  if (companies.length <= 1) return null;

  return (
    <Select
      value={currentCompanyId ?? ALL_COMPANIES}
      onValueChange={(v) => setCurrentCompanyId(v === ALL_COMPANIES ? null : v)}
    >
      <SelectTrigger className={cn("w-[220px]", className)}>
        <Building2 className="h-4 w-4 mr-1.5 text-muted-foreground shrink-0" />
        <SelectValue placeholder="Empresa" />
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        {allowAll && <SelectItem value={ALL_COMPANIES}>Todas as empresas</SelectItem>}
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.trade_name || c.legal_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default CompanySelector;
