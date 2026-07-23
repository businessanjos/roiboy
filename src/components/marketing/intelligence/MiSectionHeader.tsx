import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho consistente de seção dentro de Market Intelligence.
 * Cria hierarquia visual clara com ícone leve à esquerda, título/desc
 * empilhados e slot de ação à direita (ex.: botão "Recalcular").
 */
export function MiSectionHeader({ icon: Icon, title, description, action, className }: Props) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-4", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
