import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

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
  const { user, loading: authLoading } = useAuth();
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
    // Wait for auth to finish loading
    if (authLoading) return;
    
    // If no user, don't make queries - let AppLayout handle redirect
    if (!user) {
      setStatus(prev => ({ ...prev, isLoading: false }));
      return;
    }

    async function checkSubscription() {
      try {
        // Check if user is super admin first
        const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", { _user_id: user!.id });
        
        if (isSuperAdmin === true) {
          setStatus({
            isLoading: false,
            hasAccess: true,
            isTrialExpired: false,
            trialEndsAt: null,
            subscriptionStatus: "active",
            daysRemaining: null,
            paymentMethodConfigured: true,
          });
          return;
        }

        const { data: userData } = await supabase
          .from("users")
          .select("account_id")
          .eq("auth_user_id", user!.id)
          .maybeSingle();

        if (!userData?.account_id) {
          setStatus(prev => ({ ...prev, isLoading: false, hasAccess: false }));
          return;
        }

        const { data: account } = await supabase
          .from("accounts")
          .select("subscription_status, trial_ends_at, plan_id, payment_method_configured")
          .eq("id", userData.account_id)
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
        
        // Trial logic
        const isInTrial = account.subscription_status === "trial";
        
        // Grant access if:
        // 1. Has active subscription (active, paid, trialing, pending)
        // 2. Trial with no expiration date set (internal/dev accounts - unlimited trial)
        // 3. Trial not expired and has payment method configured
        const hasUnlimitedTrial = isInTrial && !trialEndsAt; // No expiration = unlimited trial
        const hasValidTrial = isInTrial && !isTrialExpired && account.payment_method_configured;
        
        const hasAccess = hasActiveSubscription || hasUnlimitedTrial || hasValidTrial;

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
  }, [user, authLoading]);

  return status;
}
