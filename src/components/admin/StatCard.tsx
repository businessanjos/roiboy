import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  variant?: 'success' | 'warning' | 'danger';
}

export const StatCard = memo(function StatCard({ icon: Icon, label, value, variant }: StatCardProps) {
  const colorClass = variant === 'success' ? 'text-emerald-600' : 
                     variant === 'warning' ? 'text-amber-600' : 
                     variant === 'danger' ? 'text-red-600' : 'text-foreground';
  const bgClass = variant === 'success' ? 'bg-emerald-500/10' : 
                  variant === 'warning' ? 'bg-amber-500/10' : 
                  variant === 'danger' ? 'bg-red-500/10' : 'bg-muted';

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-lg ${bgClass}`}>
            <Icon className={`h-5 w-5 ${variant ? colorClass : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-semibold ${colorClass}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
