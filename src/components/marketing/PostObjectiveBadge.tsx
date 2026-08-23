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
    className: 'bg-success-soft text-success-strong border-success dark:bg-success/30 dark:text-success dark:border-success',
  },
  connection: {
    label: 'Conexão',
    icon: Heart,
    className: 'bg-info-soft text-info-strong border-info dark:bg-info/30 dark:text-info dark:border-info',
  },
  authority: {
    label: 'Autoridade',
    icon: Award,
    className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900',
  },
  sales: {
    label: 'Vendas',
    icon: ShoppingCart,
    className: 'bg-warning-soft text-warning-strong border-warning dark:bg-warning/30 dark:text-warning dark:border-warning',
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
