import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Aplica o tema "Ecossistema Ryka" apenas no conteúdo interno.
 * Os tokens ficam escopados na classe `.ryka` (src/styles/ryka.css),
 * então nenhuma outra área do app é afetada.
 */
export function RykaScope({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ryka min-h-full", className)} {...props} />;
}
