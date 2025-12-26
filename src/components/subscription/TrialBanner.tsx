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
        isLastDay && "bg-destructive text-destructive-foreground border-destructive",
        isUrgent && !isLastDay && "bg-status-warning text-white border-status-warning",
        !isUrgent && "bg-primary/90 text-primary-foreground border-primary"
      )}
    >
      <div className="flex items-center gap-2">
        {isLastDay ? (
          <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
        ) : isUrgent ? (
          <Clock className="h-4 w-4 shrink-0" />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0" />
        )}
        <span className="font-medium">
          {isLastDay
            ? "Último dia do seu período de teste!"
            : daysRemaining !== null
            ? `${daysRemaining} ${daysRemaining === 1 ? "dia restante" : "dias restantes"} do período de teste`
            : "Você está no período de teste"}
        </span>
      </div>
      <Button 
        asChild 
        size="sm" 
        variant="secondary"
        className={cn(
          isLastDay && "bg-white text-destructive hover:bg-white/90",
          isUrgent && !isLastDay && "bg-white text-status-warning hover:bg-white/90",
          !isUrgent && "bg-white text-primary hover:bg-white/90"
        )}
      >
        <Link to="/choose-plan">
          {isUrgent ? "Assinar agora" : "Ver planos"}
        </Link>
      </Button>
    </div>
  );
}
