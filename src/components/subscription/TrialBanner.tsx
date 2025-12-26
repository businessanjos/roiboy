import { Link } from "react-router-dom";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { AlertTriangle, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TrialBanner() {
  const { isLoading, subscriptionStatus, daysRemaining, isTrialExpired } = useSubscriptionStatus();

  // Don't show banner if loading or has active subscription
  if (isLoading) return null;
  if (subscriptionStatus === "active" || subscriptionStatus === "paid") return null;

  // Show nothing if trial is expired (they'll be redirected)
  if (isTrialExpired) return null;

  // Only show for trial status
  if (subscriptionStatus !== "trial") return null;

  const isUrgent = daysRemaining !== null && daysRemaining <= 3;
  const isLastDay = daysRemaining !== null && daysRemaining <= 1;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2 text-sm border-b",
        isLastDay && "bg-destructive/10 border-destructive/20 text-destructive",
        isUrgent && !isLastDay && "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
        !isUrgent && "bg-primary/5 border-primary/10 text-muted-foreground"
      )}
    >
      <div className="flex items-center gap-2">
        {isLastDay ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : isUrgent ? (
          <Clock className="h-4 w-4 shrink-0" />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0" />
        )}
        <span>
          {isLastDay
            ? "Último dia do seu período de teste!"
            : daysRemaining !== null
            ? `${daysRemaining} ${daysRemaining === 1 ? "dia restante" : "dias restantes"} do período de teste`
            : "Você está no período de teste"}
        </span>
      </div>
      <Button asChild size="sm" variant={isUrgent ? "default" : "outline"}>
        <Link to="/choose-plan">
          {isUrgent ? "Assinar agora" : "Ver planos"}
        </Link>
      </Button>
    </div>
  );
}
