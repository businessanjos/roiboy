import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanInfo {
  planName: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  daysRemaining: number | null;
}

export function SidebarPlanInfo({ collapsed }: { collapsed: boolean }) {
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);

  useEffect(() => {
    async function fetchPlanInfo() {
      try {
        const { data: user } = await supabase
          .from("users")
          .select("account_id")
          .maybeSingle();

        if (!user?.account_id) return;

        const { data: account } = await supabase
          .from("accounts")
          .select(`
            subscription_status,
            trial_ends_at,
            plan_id,
            subscription_plans (name)
          `)
          .eq("id", user.account_id)
          .maybeSingle();

        if (!account) return;

        const trialEndsAt = account.trial_ends_at ? new Date(account.trial_ends_at) : null;
        const now = new Date();
        let daysRemaining: number | null = null;
        
        if (trialEndsAt && account.subscription_status === "trial") {
          daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysRemaining < 0) daysRemaining = 0;
        }

        const planData = account.subscription_plans as { name: string } | null;

        setPlanInfo({
          planName: planData?.name || null,
          subscriptionStatus: account.subscription_status,
          trialEndsAt,
          daysRemaining,
        });
      } catch (error) {
        console.error("Error fetching plan info:", error);
      }
    }

    fetchPlanInfo();
  }, []);

  if (!planInfo) return null;

  const isTrialing = planInfo.subscriptionStatus === "trial";
  const isActive = ["active", "paid"].includes(planInfo.subscriptionStatus || "");
  const isExpiring = isTrialing && planInfo.daysRemaining !== null && planInfo.daysRemaining <= 3;

  if (collapsed) {
    return (
      <Link 
        to="/account-settings"
        className={cn(
          "flex items-center justify-center p-2 mx-3 mb-2 rounded-lg transition-colors",
          isExpiring 
            ? "bg-destructive/10 text-destructive" 
            : isActive 
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
        )}
        title={isTrialing ? `${planInfo.daysRemaining} dias restantes` : planInfo.planName || "Ver plano"}
      >
        {isActive ? <Crown className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
      </Link>
    );
  }

  return (
    <Link
      to="/account-settings"
      className={cn(
        "flex items-center gap-3 p-3 mx-3 mb-2 rounded-lg transition-all hover:opacity-80",
        isExpiring 
          ? "bg-destructive/10 border border-destructive/20" 
          : isActive 
            ? "bg-primary/10 border border-primary/20"
            : "bg-muted border border-border"
      )}
    >
      <div className={cn(
        "flex items-center justify-center w-8 h-8 rounded-full",
        isExpiring 
          ? "bg-destructive/20 text-destructive" 
          : isActive 
            ? "bg-primary/20 text-primary"
            : "bg-muted-foreground/20 text-muted-foreground"
      )}>
        {isActive ? <Crown className="h-4 w-4" /> : isTrialing ? <Clock className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div className="flex flex-col min-w-0">
        <span className={cn(
          "text-xs font-medium truncate",
          isExpiring ? "text-destructive" : isActive ? "text-primary" : "text-foreground"
        )}>
          {isActive ? planInfo.planName || "Plano Ativo" : isTrialing ? "Período de Teste" : "Sem plano"}
        </span>
        <span className={cn(
          "text-[10px] truncate",
          isExpiring ? "text-destructive/80" : "text-muted-foreground"
        )}>
          {isTrialing && planInfo.daysRemaining !== null
            ? planInfo.daysRemaining === 0 
              ? "Expira hoje!"
              : planInfo.daysRemaining === 1 
                ? "1 dia restante"
                : `${planInfo.daysRemaining} dias restantes`
            : isActive 
              ? "Clique para gerenciar"
              : "Escolher plano"}
        </span>
      </div>
    </Link>
  );
}
