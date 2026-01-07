import { TrendingUp, Heart, Award, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type PostObjective = 'growth' | 'connection' | 'authority' | 'sales';

interface PostObjectiveBadgeProps {
  objective: PostObjective | null;
  confidence?: number | null;
  className?: string;
}

const objectiveConfig: Record<PostObjective, {
  label: string;
  icon: typeof TrendingUp;
  className: string;
}> = {
  growth: {
    label: 'Crescimento',
    icon: TrendingUp,
    className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900',
  },
  connection: {
    label: 'Conexão',
    icon: Heart,
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900',
  },
  authority: {
    label: 'Autoridade',
    icon: Award,
    className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900',
  },
  sales: {
    label: 'Vendas',
    icon: ShoppingCart,
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900',
  },
};

export function PostObjectiveBadge({ objective, confidence, className }: PostObjectiveBadgeProps) {
  if (!objective) {
    return (
      <Badge variant="outline" className={cn('text-muted-foreground', className)}>
        Não classificado
      </Badge>
    );
  }

  const config = objectiveConfig[objective];
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'gap-1 font-medium',
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
      {confidence && confidence >= 90 && (
        <span className="ml-0.5 opacity-60">✓</span>
      )}
    </Badge>
  );
}
