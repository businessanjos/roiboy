import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SocialMediaKPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'insight';
}

export function SocialMediaKPICard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  description,
  variant = 'default',
}: SocialMediaKPICardProps) {
  const getTrendIcon = () => {
    if (trend === undefined) return null;
    if (trend > 0) return TrendingUp;
    if (trend < 0) return TrendingDown;
    return Minus;
  };

  const getTrendColor = () => {
    if (trend === undefined) return '';
    if (trend > 0) return 'text-success';
    if (trend < 0) return 'text-danger';
    return 'text-muted-foreground';
  };

  const TrendIcon = getTrendIcon();

  const variantStyles = {
    default: 'bg-card',
    success: 'bg-success-soft dark:bg-success/20 border-success dark:border-success',
    warning: 'bg-warning-soft dark:bg-warning/20 border-warning dark:border-warning',
    insight: 'bg-primary/5 border-primary/20',
  };

  return (
    <Card className={cn(
      'transition-all hover:shadow-md',
      variantStyles[variant]
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{value}</span>
              {trend !== undefined && TrendIcon && (
                <div className={cn('flex items-center gap-0.5 text-sm font-medium', getTrendColor())}>
                  <TrendIcon className="h-3.5 w-3.5" />
                  <span>{Math.abs(trend)}%</span>
                </div>
              )}
            </div>
            {trendLabel && (
              <p className="text-xs text-muted-foreground mt-1">{trendLabel}</p>
            )}
            {description && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
            )}
          </div>
          <div className={cn(
            'p-2.5 rounded-lg',
            variant === 'insight' ? 'bg-primary/10' : 'bg-muted/50'
          )}>
            <Icon className={cn(
              'h-5 w-5',
              variant === 'insight' ? 'text-primary' : 'text-muted-foreground'
            )} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
