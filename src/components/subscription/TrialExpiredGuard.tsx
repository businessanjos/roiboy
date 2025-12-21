import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

// Routes that are always accessible (even with expired trial)
const PUBLIC_ROUTES = [
  "/auth",
  "/choose-plan",
  "/account-settings",
  "/profile",
  "/f/",
  "/checkin/",
  "/sobre",
  "/extension-preview",
];

interface TrialExpiredGuardProps {
  children: React.ReactNode;
}

export function TrialExpiredGuard({ children }: TrialExpiredGuardProps) {
  const { isLoading, hasAccess, isTrialExpired, subscriptionStatus, paymentMethodConfigured, daysRemaining } = useSubscriptionStatus();
  const navigate = useNavigate();
  const location = useLocation();

  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    location.pathname.startsWith(route)
  );

  const isTrialWithoutPayment = subscriptionStatus === "trial" && !paymentMethodConfigured && !isTrialExpired;

  useEffect(() => {
    // Skip check for public routes
    if (isPublicRoute) return;
    
    // Wait for loading to complete
    if (isLoading) return;

    // Redirect to choose plan if trial expired and no active subscription
    if (isTrialExpired && !hasAccess) {
      navigate("/choose-plan", { replace: true });
    }
  }, [isLoading, hasAccess, isTrialExpired, isPublicRoute, navigate]);

  // Show loading state
  if (isLoading && !isPublicRoute) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Verificando assinatura...</p>
        </div>
      </div>
    );
  }

  // Block access if trial without payment method configured
  if (!isPublicRoute && isTrialWithoutPayment) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-6 max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Configure seu pagamento</h1>
            <p className="text-muted-foreground">
              Para acessar o sistema durante o período de teste
              {daysRemaining !== null && ` (${daysRemaining} dias restantes)`}, 
              você precisa cadastrar um cartão de crédito ou gerar um PIX.
            </p>
          </div>
          <Button 
            onClick={() => navigate("/profile?tab=subscription")} 
            className="w-full"
            size="lg"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Configurar Pagamento
          </Button>
        </div>
      </div>
    );
  }

  // Block access if trial expired (except for public routes)
  if (!isPublicRoute && isTrialExpired && !hasAccess) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}
