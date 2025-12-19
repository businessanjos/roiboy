import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Lock, TrendingUp } from "lucide-react";
import { usePlanLimits, ResourceType } from "@/hooks/usePlanLimits";
import { useNavigate } from "react-router-dom";

interface PlanLimitAlertProps {
  resource: ResourceType;
  showProgress?: boolean;
  className?: string;
}

const RESOURCE_LABELS: Record<ResourceType, { singular: string; plural: string }> = {
  clients: { singular: "cliente", plural: "clientes" },
  users: { singular: "usuário", plural: "usuários" },
  events: { singular: "evento", plural: "eventos" },
  products: { singular: "produto", plural: "produtos" },
  forms: { singular: "formulário", plural: "formulários" },
  ai_analyses: { singular: "análise de IA", plural: "análises de IA" },
};

export function PlanLimitAlert({ resource, showProgress = true, className }: PlanLimitAlertProps) {
  const { data, canCreate, getRemainingQuota, getUsagePercentage, isNearLimit } = usePlanLimits();
  const navigate = useNavigate();

  if (!data) return null;

  const percentage = getUsagePercentage(resource);
  const remaining = getRemainingQuota(resource);
  const labels = RESOURCE_LABELS[resource];
  const atLimit = !canCreate(resource);
  const nearLimit = isNearLimit(resource);

  // Don't show anything if usage is low
  if (!nearLimit && !atLimit) return null;

  return (
    <Alert
      variant={atLimit ? "destructive" : "default"}
      className={className}
    >
      {atLimit ? (
        <Lock className="h-4 w-4" />
      ) : (
        <AlertTriangle className="h-4 w-4" />
      )}
      <AlertTitle>
        {atLimit
          ? `Limite de ${labels.plural} atingido`
          : `Você está próximo do limite de ${labels.plural}`}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {atLimit
            ? `Você atingiu o limite de ${data.usage[resource]} ${labels.plural} do seu plano ${data.plan_name}.`
            : `Você já usou ${data.usage[resource]} de ${data.limits[`max_${resource}` as keyof typeof data.limits]} ${labels.plural} (${remaining} restante${remaining !== 1 ? "s" : ""}).`}
        </p>
        {showProgress && (
          <Progress value={percentage} className="h-2" />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/settings")}
          className="mt-2"
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Fazer upgrade do plano
        </Button>
      </AlertDescription>
    </Alert>
  );
}

interface PlanLimitGateProps {
  resource: ResourceType;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PlanLimitGate({ resource, children, fallback }: PlanLimitGateProps) {
  const { canCreate, loading } = usePlanLimits();

  if (loading) return null;

  if (!canCreate(resource)) {
    return fallback ? <>{fallback}</> : <PlanLimitAlert resource={resource} />;
  }

  return <>{children}</>;
}

interface LimitedButtonProps {
  resource: ResourceType;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
}

export function LimitedButton({
  resource,
  onClick,
  children,
  className,
  variant = "default",
  size = "default",
  disabled = false,
}: LimitedButtonProps) {
  const { canCreate, loading, getRemainingQuota } = usePlanLimits();
  const navigate = useNavigate();
  const labels = RESOURCE_LABELS[resource];

  const isAtLimit = !canCreate(resource);

  const handleClick = () => {
    if (isAtLimit) {
      navigate("/settings");
    } else {
      onClick();
    }
  };

  return (
    <Button
      variant={isAtLimit ? "outline" : variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={disabled || loading}
      title={isAtLimit ? `Limite de ${labels.plural} atingido. Clique para fazer upgrade.` : undefined}
    >
      {isAtLimit && <Lock className="h-4 w-4 mr-2" />}
      {children}
    </Button>
  );
}
