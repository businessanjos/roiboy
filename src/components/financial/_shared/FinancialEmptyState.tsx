import { ReactNode } from "react";
import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
  className?: string;
  compact?: boolean;
}

/**
 * Estado vazio padronizado e amigável.
 * Use sempre que uma seção/lista não tem dados — nunca deixe área vazia
 * sem feedback.
 */
export function FinancialEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-14 px-6",
        className,
      )}
    >
      <div className="rounded-full bg-muted p-3 mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <Button
          size="sm"
          className="mt-4"
          onClick={action.onClick}
          variant="outline"
        >
          {action.icon && <action.icon className="h-4 w-4 mr-1.5" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
