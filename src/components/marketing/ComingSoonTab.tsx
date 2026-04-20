import { Card } from "@/components/ui/card";
import { Sparkles, TrendingUp, Construction } from "lucide-react";

interface Props {
  title: string;
  description: string;
  icon: "trends" | "copy";
}

export function ComingSoonTab({ title, description, icon }: Props) {
  const Icon = icon === "trends" ? TrendingUp : Sparkles;
  return (
    <Card className="p-12 text-center bg-gradient-to-br from-primary/5 to-accent/5 border-dashed">
      <div className="inline-flex p-4 rounded-full bg-primary/10 text-primary mb-4">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-4">{description}</p>
      <div className="inline-flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
        <Construction className="h-4 w-4" />
        Próxima entrega: Fase 2 (IA + integrações)
      </div>
    </Card>
  );
}
