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
        "flex items-center justify-between gap-4 px-4 py-2.5 text-sm border-b",
        isLastDay && "bg-gradient-to-r from-destructive/20 to-destructive/10 border-destructive/30 text-destructive",
        isUrgent && !isLastDay && "bg-gradient-to-r from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300",
        !isUrgent && "bg-gradient-to-r from-violet-500/15 to-indigo-500/10 border-violet-500/20 text-violet-700 dark:text-violet-300"
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
            ? "⚠️ Último dia do seu período de teste!"
            : daysRemaining !== null
            ? `✨ ${daysRemaining} ${daysRemaining === 1 ? "dia restante" : "dias restantes"} do período de teste`
            : "✨ Você está no período de teste"}
        </span>
      </div>
      <Button 
        asChild 
        size="sm" 
        className={cn(
          isUrgent 
            ? "bg-amber-600 hover:bg-amber-700 text-white" 
            : "bg-violet-600 hover:bg-violet-700 text-white border-0"
        )}
      >
        <Link to="/choose-plan">
          {isUrgent ? "Assinar agora" : "Ver planos"}
        </Link>
      </Button>
    </div>
  );
}
