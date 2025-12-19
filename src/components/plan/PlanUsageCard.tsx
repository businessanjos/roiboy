import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanLimits, ResourceType } from "@/hooks/usePlanLimits";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  UserCircle, 
  CalendarDays, 
  Package, 
  FileText, 
  Sparkles,
  TrendingUp,
  Crown
} from "lucide-react";
import { cn } from "@/lib/utils";

const RESOURCE_CONFIG: Record<ResourceType, { icon: typeof Users; label: string; color: string }> = {
  clients: { icon: Users, label: "Clientes", color: "text-blue-500" },
  users: { icon: UserCircle, label: "Usuários", color: "text-purple-500" },
  events: { icon: CalendarDays, label: "Eventos", color: "text-green-500" },
  products: { icon: Package, label: "Produtos", color: "text-orange-500" },
  forms: { icon: FileText, label: "Formulários", color: "text-pink-500" },
  ai_analyses: { icon: Sparkles, label: "Análises IA", color: "text-cyan-500" },
};

interface UsageItemProps {
  resource: ResourceType;
  usage: number;
  limit: number;
}

function UsageItem({ resource, usage, limit }: UsageItemProps) {
  const config = RESOURCE_CONFIG[resource];
  const Icon = config.icon;
  const percentage = limit > 0 ? Math.min(100, Math.round((usage / limit) * 100)) : 0;
  const isNearLimit = percentage >= 80;
  const atLimit = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", config.color)} />
          <span className="font-medium">{config.label}</span>
        </div>
        <span className={cn(
          "text-muted-foreground",
          isNearLimit && "text-amber-600 dark:text-amber-400",
          atLimit && "text-destructive"
        )}>
          {usage} / {limit}
        </span>
      </div>
      <Progress 
        value={percentage} 
        className={cn(
          "h-2",
          atLimit && "[&>div]:bg-destructive",
          isNearLimit && !atLimit && "[&>div]:bg-amber-500"
        )} 
      />
    </div>
  );
}

export function PlanUsageCard() {
  const { data, loading } = usePlanLimits();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const resources: ResourceType[] = ["clients", "users", "events", "products", "forms", "ai_analyses"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Uso do Plano
            </CardTitle>
            <CardDescription>
              Plano atual: <Badge variant="secondary">{data.plan_name}</Badge>
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Upgrade
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {resources.map((resource) => (
          <UsageItem
            key={resource}
            resource={resource}
            usage={data.usage[resource]}
            limit={data.limits[`max_${resource}` as keyof typeof data.limits] as number}
          />
        ))}
      </CardContent>
    </Card>
  );
}
