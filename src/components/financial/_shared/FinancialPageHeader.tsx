import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho padronizado para todas as páginas de Finanças.
 * Mantém hierarquia consistente: ícone + título + descrição à esquerda,
 * ações (período, botões) à direita.
 */
export function FinancialPageHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: Props) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          {Icon && <Icon className="h-6 w-6 text-primary shrink-0" />}
          <span className="truncate">{title}</span>
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
