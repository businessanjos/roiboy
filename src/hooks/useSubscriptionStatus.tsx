import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionStatus {
  isLoading: boolean;
  hasAccess: boolean;
  isTrialExpired: boolean;
  trialEndsAt: Date | null;
  subscriptionStatus: string | null;
  daysRemaining: number | null;
  paymentMethodConfigured: boolean;
}

export function useSubscriptionStatus(): SubscriptionStatus {
  const [status, setStatus] = useState<SubscriptionStatus>({
    isLoading: true,
    hasAccess: true,
    isTrialExpired: false,
    trialEndsAt: null,
    subscriptionStatus: null,
    daysRemaining: null,
    paymentMethodConfigured: false,
  });

  useEffect(() => {
    async function checkSubscription() {
      try {
        const { data: user } = await supabase
          .from("users")
          .select("account_id")
          .maybeSingle();

        if (!user?.account_id) {
          setStatus(prev => ({ ...prev, isLoading: false, hasAccess: false }));
          return;
        }

        const { data: account } = await supabase
          .from("accounts")
          .select("subscription_status, trial_ends_at, plan_id, payment_method_configured")
          .eq("id", user.account_id)
          .maybeSingle();

        if (!account) {
          setStatus(prev => ({ ...prev, isLoading: false, hasAccess: false }));
          return;
        }

        const now = new Date();
        const trialEndsAt = account.trial_ends_at ? new Date(account.trial_ends_at) : null;
        const isTrialExpired = trialEndsAt ? now > trialEndsAt : false;
        
        // Calculate days remaining
        let daysRemaining: number | null = null;
        if (trialEndsAt && !isTrialExpired) {
          daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }

        // User has access if:
        // 1. Subscription is active/paid/pending
        // 2. Trial with payment method configured (credit card or PIX)
        const paidStatuses = ["active", "paid", "trialing", "pending"];
        const hasActiveSubscription = paidStatuses.includes(account.subscription_status || "");
        
        // For trial users: must have payment method configured to access
        const isInTrial = account.subscription_status === "trial" && !isTrialExpired;
        const trialWithPayment = isInTrial && account.payment_method_configured;
        
        const hasAccess = hasActiveSubscription || trialWithPayment;

        setStatus({
          isLoading: false,
          hasAccess,
          isTrialExpired: account.subscription_status === "trial" && isTrialExpired,
          trialEndsAt,
          subscriptionStatus: account.subscription_status,
          daysRemaining,
          paymentMethodConfigured: account.payment_method_configured || false,
        });
      } catch (error) {
        console.error("Error checking subscription:", error);
        setStatus(prev => ({ ...prev, isLoading: false, hasAccess: true })); // Fail open
      }
    }

    checkSubscription();
  }, []);

  return status;
}
