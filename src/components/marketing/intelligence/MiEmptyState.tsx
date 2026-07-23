import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  variant?: "card" | "inline";
}

/**
 * Estado vazio canônico para Market Intelligence.
 * Substitui variações locais ("Sem dado ainda", "Nunca coletado", cards custom).
 */
export function MiEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = "card",
}: Props) {
  const body = (
    <div className={cn("flex flex-col items-center text-center gap-2 py-8 px-4", className)}>
      {Icon && (
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-1">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );

  if (variant === "inline") return body;

  return (
    <Card className="border-dashed">
      <CardContent className="p-0">{body}</CardContent>
    </Card>
  );
}
