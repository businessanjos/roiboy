import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { CurrentUserProvider } from "@/hooks/useCurrentUser";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { PermissionsProvider } from "@/hooks/usePermissions";
import { PlanLimitsProvider } from "@/hooks/usePlanLimits";
import { ImpersonationProvider } from "@/hooks/useImpersonation";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/ui/loading-screen";

// Eager loaded pages (critical for UX)
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

// Lazy loaded pages
const Clients = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Settings = lazy(() => import("./pages/Settings"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const Products = lazy(() => import("./pages/Products"));
const Events = lazy(() => import("./pages/Events"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const Team = lazy(() => import("./pages/Team"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Profile = lazy(() => import("./pages/Profile"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Forms = lazy(() => import("./pages/Forms"));
const PublicForm = lazy(() => import("./pages/PublicForm"));
const PublicRSVP = lazy(() => import("./pages/PublicRSVP"));
const PublicEventRegistration = lazy(() => import("./pages/PublicEventRegistration"));
const Presentation = lazy(() => import("./pages/Presentation"));
const ExtensionPreview = lazy(() => import("./pages/ExtensionPreview"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const Admin = lazy(() => import("./pages/Admin"));
const EventCheckin = lazy(() => import("./pages/EventCheckin"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const ChoosePlan = lazy(() => import("./pages/ChoosePlan"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Download = lazy(() => import("./pages/Download"));
const Home = lazy(() => import("./pages/Home"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
    },
  },
});

function PageLoader() {
  return <LoadingScreen message="Carregando..." fullScreen={false} />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <CurrentUserProvider>
          <ImpersonationProvider>
            <PermissionsProvider>
              <PlanLimitsProvider>
                <NotificationsProvider>
                  <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <ImpersonationBanner />
                    <BrowserRouter>
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          <Route path="/" element={<Navigate to="/dashboard" replace />} />
                          <Route path="/home" element={<Home />} />
                          <Route path="/auth" element={<Auth />} />
                          <Route path="/f/:formId" element={<PublicForm />} />
          <Route path="/rsvp/:token" element={<PublicRSVP />} />
          <Route path="/inscricao/:code" element={<PublicEventRegistration />} />
          <Route path="/checkin/:code" element={<EventCheckin />} />
                          <Route path="/sobre" element={<Presentation />} />
                          <Route path="/extension-preview" element={<ExtensionPreview />} />
                          <Route path="/onboarding" element={<Onboarding />} />
                          <Route path="/choose-plan" element={<ChoosePlan />} />
                          <Route path="/termos" element={<TermsOfService />} />
                          <Route path="/privacidade" element={<PrivacyPolicy />} />
                          <Route path="/download" element={<Download />} />
                          <Route element={<AppLayout />}>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/clients" element={<Clients />} />
                            <Route path="/clients/new" element={<Clients />} />
                            <Route path="/clients/:id" element={<ClientDetail />} />
                            <Route path="/products" element={<Products />} />
                            <Route path="/events" element={<Events />} />
                            <Route path="/events/:id" element={<EventDetail />} />
                            <Route path="/tasks" element={<Tasks />} />
                            <Route path="/forms" element={<Forms />} />
                            <Route path="/integrations" element={<Integrations />} />
                            <Route path="/team" element={<Team />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/notifications" element={<Notifications />} />
                            <Route path="/presentation" element={<Presentation />} />
                            <Route path="/api-docs" element={<ApiDocs />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/account-settings" element={<AccountSettings />} />
                            <Route path="/admin" element={<Admin />} />
                          </Route>
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                    </BrowserRouter>
                  </TooltipProvider>
                </NotificationsProvider>
              </PlanLimitsProvider>
            </PermissionsProvider>
          </ImpersonationProvider>
        </CurrentUserProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
