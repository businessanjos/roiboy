import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { Loader2 } from "lucide-react";

// Routes that are always accessible (even with expired trial)
const PUBLIC_ROUTES = [
  "/auth",
  "/choose-plan",
  "/account-settings",
  "/f/",
  "/checkin/",
  "/sobre",
  "/extension-preview",
];

interface TrialExpiredGuardProps {
  children: React.ReactNode;
}

export function TrialExpiredGuard({ children }: TrialExpiredGuardProps) {
  const { isLoading, hasAccess, isTrialExpired } = useSubscriptionStatus();
  const navigate = useNavigate();
  const location = useLocation();

  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    location.pathname.startsWith(route)
  );

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

  // Block access if trial expired (except for public routes)
  if (!isPublicRoute && isTrialExpired && !hasAccess) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}
