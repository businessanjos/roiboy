import { Building2 } from "lucide-react";
import type { Company } from "@/contexts/CompanyContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PipelineCompanyFilterProps {
  companies: Company[];
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
}

export function PipelineCompanyFilter({ companies, value, onChange, loading }: PipelineCompanyFilterProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      <Select value={value} onValueChange={onChange} disabled={loading}>
        <SelectTrigger
          id="pipeline-company-filter"
          aria-label="Filtrar por empresa"
          className={cn("min-h-11 gap-2 text-base sm:text-sm", value !== "all" && "border-primary/60 text-primary")}
        >
          <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left">
            <SelectValue placeholder={loading ? "Carregando empresas…" : "Todas as empresas"} />
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="min-h-11">Todas as empresas</SelectItem>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id} className="min-h-11">
              {company.trade_name || company.legal_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}