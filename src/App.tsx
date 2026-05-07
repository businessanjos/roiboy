import { lazy, Suspense, ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { CurrentUserProvider } from "@/hooks/useCurrentUser";
import { PermissionsProvider } from "@/hooks/usePermissions";
import { ImpersonationProvider } from "@/hooks/useImpersonation";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { SectorProvider } from "@/contexts/SectorContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/ui/loading-screen";

// Retry wrapper for lazy imports to handle stale chunk errors after deploys
function lazyRetry<P extends object>(
  factory: () => Promise<{ default: ComponentType<P> }>,
  retries = 2
): React.LazyExoticComponent<ComponentType<P>> {
  const retryFactory = (attempt: number): Promise<{ default: ComponentType<P> }> =>
    factory().catch((err) => {
      if (attempt > 0) {
        return new Promise<{ default: ComponentType<P> }>((resolve) => {
          setTimeout(() => resolve(retryFactory(attempt - 1)), 500);
        });
      }
      // Last resort: full page reload to get fresh asset manifest
      window.location.reload();
      return factory();
    });

  return lazy(() => retryFactory(retries));
}

// Eager loaded pages (critical for UX - auth, initial route and 404)
import Auth from "./pages/Auth";
import Sectors from "./pages/Sectors";
import NotFound from "./pages/NotFound";
import SalesTeam from "./pages/SalesTeam";

// ZappErrorBoundary - lazy loaded (was eagerly imported, 1.2s load time)
const ZappErrorBoundary = lazyRetry(() => import("@/components/royzapp/ZappErrorBoundary").then(m => ({ default: m.ZappErrorBoundary })));

// Lazy loaded pages
const Dashboard = lazyRetry(() => import("./pages/Dashboard"));
const Clients = lazyRetry(() => import("./pages/Clients"));
const DoubleChairList = lazyRetry(() => import("./pages/DoubleChairList"));
const VipClients = lazyRetry(() => import("./pages/VipClients"));
const Renewals = lazyRetry(() => import("./pages/Renewals"));
const ConsultantBonus = lazyRetry(() => import("./pages/ConsultantBonus"));
const ClientDetail = lazyRetry(() => import("./pages/ClientDetail"));
const Integrations = lazyRetry(() => import("./pages/Integrations"));
const Settings = lazyRetry(() => import("./pages/Settings"));
const AccountSettings = lazyRetry(() => import("./pages/AccountSettings"));
const Products = lazyRetry(() => import("./pages/Products"));
const Events = lazyRetry(() => import("./pages/Events"));
const EventDetail = lazyRetry(() => import("./pages/EventDetail"));
// Team moved to Settings
const Tasks = lazyRetry(() => import("./pages/Tasks"));

const Notifications = lazyRetry(() => import("./pages/Notifications"));
const Forms = lazyRetry(() => import("./pages/Forms"));
const PublicForm = lazyRetry(() => import("./pages/PublicForm"));
const PublicRSVP = lazyRetry(() => import("./pages/PublicRSVP"));
const PublicEventRegistration = lazyRetry(() => import("./pages/PublicEventRegistration"));
const PublicEventFeedback = lazyRetry(() => import("./pages/PublicEventFeedback"));

const Admin = lazyRetry(() => import("./pages/Admin"));
const EventCheckin = lazyRetry(() => import("./pages/EventCheckin"));
const Onboarding = lazyRetry(() => import("./pages/Onboarding"));

const TermsOfService = lazyRetry(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazyRetry(() => import("./pages/PrivacyPolicy"));

const SalesScripts = lazyRetry(() => import("./pages/SalesScripts"));
const Reminders = lazyRetry(() => import("./pages/Reminders"));
const PublicDigitalContract = lazyRetry(() => import("./pages/PublicDigitalContract"));
const ContractDefaultsSettings = lazyRetry(() => import("./pages/ContractDefaultsSettings"));
const SalesDigitalContracts = lazyRetry(() => import("./pages/SalesDigitalContracts"));
const SalesContractTemplates = lazyRetry(() => import("./pages/SalesContractTemplates"));

const RoyZapp = lazyRetry(() => import("./pages/RoyZapp"));
const EverIA = lazyRetry(() => import("./pages/EverIA"));

const BillingPortal = lazyRetry(() => import("./pages/BillingPortal"));
const Contracts = lazyRetry(() => import("./pages/Contracts"));
const SalesPipeline = lazyRetry(() => import("./pages/SalesPipeline"));
const SalesCalendar = lazyRetry(() => import("./pages/SalesCalendar"));
const SpiffsTracking = lazyRetry(() => import("./pages/SpiffsTracking"));
const IncentivePresentation = lazyRetry(() => import("./pages/IncentivePresentation"));
const CsIncentivePresentation = lazyRetry(() => import("./pages/CsIncentivePresentation"));
const Leads = lazyRetry(() => import("./pages/Leads"));

const Marketing = lazyRetry(() => import("./pages/Marketing"));
const ContentCalendar = lazyRetry(() => import("./pages/ContentCalendar"));
const SocialMedia = lazyRetry(() => import("./pages/SocialMedia"));
const MarketingTasks = lazyRetry(() => import("./pages/MarketingTasks"));
const MarketingInsights = lazyRetry(() => import("./pages/MarketingInsights"));
const MarketingTrafegoPago = lazyRetry(() => import("./pages/marketing/MarketingTrafegoPago"));
const ContentCreation = lazyRetry(() => import("./pages/ContentCreation"));
const Insights = lazyRetry(() => import("./pages/Insights"));
const RHDashboard = lazyRetry(() => import("./pages/RHDashboard"));
const HRCollaborators = lazyRetry(() => import("./pages/rh/HRCollaborators"));
const HRCollaboratorProfile = lazyRetry(() => import("./pages/rh/HRCollaboratorProfile"));
const OrgChart = lazyRetry(() => import("./pages/rh/OrgChart"));
const RHDepartments = lazyRetry(() => import("./pages/rh/RHDepartments"));
const RHVagas = lazyRetry(() => import("./pages/rh/RHVagas"));
const RHJobForm = lazyRetry(() => import("./pages/rh/RHJobForm"));
const RHJobDetail = lazyRetry(() => import("./pages/rh/RHJobDetail"));
const PublicJobApplication = lazyRetry(() => import("./pages/rh/PublicJobApplication"));
const HRServiceProviders = lazyRetry(() => import("./pages/rh/HRServiceProviders"));
const HRServiceProviderProfile = lazyRetry(() => import("./pages/rh/HRServiceProviderProfile"));
const HRPartners = lazyRetry(() => import("./pages/rh/HRPartners"));
const HRPartnerProfile = lazyRetry(() => import("./pages/rh/HRPartnerProfile"));
const RHPositions = lazyRetry(() => import("./pages/rh/RHPositions"));
const SharedInsights = lazyRetry(() => import("./pages/SharedInsights"));
const ExternalDashboard = lazyRetry(() => import("./pages/ExternalDashboard"));
const WhatsAppDiagnostics = lazyRetry(() => import("./pages/admin/WhatsAppDiagnostics"));
// Financial module with sub-routes (lazy loaded)
const FinancialLayout = lazyRetry(() => import("@/components/financial/FinancialLayout").then(m => ({ default: m.FinancialLayout })));
const FinancialEntriesPage = lazyRetry(() => import("./pages/financial/FinancialEntriesPage"));
const FinancialCashFlowPage = lazyRetry(() => import("./pages/financial/FinancialCashFlowPage"));
const FinancialBankAccountsPage = lazyRetry(() => import("./pages/financial/FinancialBankAccountsPage"));
const FinancialCategoriesPage = lazyRetry(() => import("./pages/financial/FinancialCategoriesPage"));
const FinancialCostCentersPage = lazyRetry(() => import("./pages/financial/FinancialCostCentersPage"));
const FinancialSuppliersPage = lazyRetry(() => import("./pages/financial/FinancialSuppliersPage"));
const FinancialRecurringPage = lazyRetry(() => import("./pages/financial/FinancialRecurringPage"));
const FinancialBudgetPage = lazyRetry(() => import("./pages/financial/FinancialBudgetPage"));
const FinancialReconciliationPage = lazyRetry(() => import("./pages/financial/FinancialReconciliationPage"));
const FinancialSalesReconciliationPage = lazyRetry(() => import("./pages/financial/FinancialSalesReconciliationPage"));
const FinancialCommissionsPage = lazyRetry(() => import("./pages/financial/FinancialCommissionsPage"));
const FinancialAlertsPage = lazyRetry(() => import("./pages/financial/FinancialAlertsPage"));
const FinancialAgingPage = lazyRetry(() => import("./pages/financial/FinancialAgingPage"));
const FinancialProfitabilityPage = lazyRetry(() => import("./pages/financial/FinancialProfitabilityPage"));
const FinancialDREPage = lazyRetry(() => import("./pages/financial/FinancialDREPage"));
const FinancialDRFPage = lazyRetry(() => import("./pages/financial/FinancialDRFPage"));
const FinancialBoletosPage = lazyRetry(() => import("./pages/financial/FinancialBoletosPage"));
const FinancialNotasFiscaisPage = lazyRetry(() => import("./pages/financial/FinancialNotasFiscaisPage"));
const FinancialBalanceSheetPage = lazyRetry(() => import("./pages/financial/FinancialBalanceSheetPage"));
const FinancialInvoicesPage = lazyRetry(() => import("./pages/financial/FinancialInvoicesPage"));
const FinancialPaymentMethodsPage = lazyRetry(() => import("./pages/financial/FinancialPaymentMethodsPage"));

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
                  <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <BrowserRouter>
                      <SectorProvider>
                        <ImpersonationBanner />
                        <Suspense fallback={<PageLoader />}>
                          <Routes>
                            <Route path="/" element={<Navigate to="/setores" replace />} />
                          
                          <Route path="/auth" element={<Auth />} />
                          <Route path="/f/:formId" element={<PublicForm />} />
                          <Route path="/rsvp/:token" element={<PublicRSVP />} />
                          <Route path="/inscricao/:code" element={<PublicEventRegistration />} />
                          <Route path="/feedback/:eventId" element={<PublicEventFeedback />} />
                          <Route path="/checkin/:code" element={<EventCheckin />} />
                          <Route path="/shared/insights/:token" element={<SharedInsights />} />
                          <Route path="/external/insights" element={<ExternalDashboard />} />
                          <Route path="/vagas/:id/aplicar" element={<PublicJobApplication />} />
                          <Route path="/onboarding" element={<Onboarding />} />
                          <Route path="/contrato/:token" element={<PublicDigitalContract />} />
                          
                          <Route path="/termos" element={<TermsOfService />} />
                          <Route path="/privacidade" element={<PrivacyPolicy />} />
                          
                          <Route element={<AppLayout />}>
                            <Route path="/setores" element={<Sectors />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/dashboard/cadeira-dupla" element={<DoubleChairList />} />
                            <Route path="/clients" element={<Clients />} />
                            <Route path="/vips" element={<VipClients />} />
                            <Route path="/clients/new" element={<Clients />} />
                            <Route path="/clients/:id" element={<ClientDetail />} />
                            <Route path="/renewals" element={<Renewals />} />
                            <Route path="/operations/consultant-bonus" element={<ConsultantBonus />} />
                            <Route path="/operations/cs-incentive-presentation" element={<CsIncentivePresentation />} />
                            <Route path="/contracts" element={<Contracts />} />
                            <Route path="/settings/contract-defaults" element={<ContractDefaultsSettings />} />
                            <Route path="/sales/contracts" element={<SalesDigitalContracts />} />
                            <Route path="/sales/contracts/templates" element={<SalesContractTemplates />} />
                            <Route path="/sales/contracts/defaults" element={<ContractDefaultsSettings />} />
                            <Route path="/pipeline" element={<SalesPipeline />} />
                            <Route path="/sales-calendar" element={<SalesCalendar />} />
                            <Route path="/sales-team" element={<SalesTeam />} />
                            <Route path="/sales-team/spiffs" element={<SpiffsTracking />} />
                            <Route path="/sales-team/incentive-presentation" element={<IncentivePresentation />} />
                            <Route path="/leads" element={<Leads />} />
                            <Route path="/financial" element={<FinancialLayout />}>
                              <Route index element={<Navigate to="/financial/entries" replace />} />
                              <Route path="entries" element={<FinancialEntriesPage />} />
                              <Route path="cash-flow" element={<FinancialCashFlowPage />} />
                              <Route path="bank-accounts" element={<FinancialBankAccountsPage />} />
                              <Route path="categories" element={<FinancialCategoriesPage />} />
                              <Route path="cost-centers" element={<FinancialCostCentersPage />} />
                              <Route path="suppliers" element={<FinancialSuppliersPage />} />
                              <Route path="recurring" element={<FinancialRecurringPage />} />
                              <Route path="budget" element={<FinancialBudgetPage />} />
                              <Route path="reconciliation" element={<FinancialReconciliationPage />} />
                              <Route path="sales-reconciliation" element={<FinancialSalesReconciliationPage />} />
                              <Route path="commissions" element={<FinancialCommissionsPage />} />
                              <Route path="alerts" element={<FinancialAlertsPage />} />
                              <Route path="aging" element={<FinancialAgingPage />} />
                              <Route path="profitability" element={<FinancialProfitabilityPage />} />
                              <Route path="dre" element={<FinancialDREPage />} />
                              <Route path="drf" element={<FinancialDRFPage />} />
                              <Route path="invoices" element={<FinancialInvoicesPage />} />
                              <Route path="boletos" element={<FinancialBoletosPage />} />
                              <Route path="notas-fiscais" element={<FinancialNotasFiscaisPage />} />
                              <Route path="balance-sheet" element={<FinancialBalanceSheetPage />} />
                              <Route path="payment-methods" element={<FinancialPaymentMethodsPage />} />
                            </Route>
                            <Route path="/products" element={<Products />} />
                            <Route path="/events" element={<Events />} />
                            <Route path="/events/:id" element={<EventDetail />} />
                            <Route path="/tasks" element={<Tasks />} />
                            <Route path="/forms" element={<Forms />} />
                            <Route path="/integrations" element={<Integrations />} />
                            <Route path="/team" element={<Navigate to="/settings" replace />} />
                            <Route path="/profile" element={<Navigate to="/settings?tab=profile" replace />} />
                            <Route path="/notifications" element={<Notifications />} />
                            
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/account-settings" element={<AccountSettings />} />
                            <Route path="/reminders" element={<Reminders />} />
                            
                            <Route path="/roy-zapp" element={<ZappErrorBoundary><RoyZapp /></ZappErrorBoundary>} />
                            <Route path="/ever-ia" element={<EverIA />} />
                            
                            <Route path="/billing" element={<BillingPortal />} />
                            
                            <Route path="/marketing" element={<Marketing />} />
                            <Route path="/content-calendar" element={<ContentCalendar />} />
                            <Route path="/social-media" element={<SocialMedia />} />
                            <Route path="/criacao" element={<ContentCreation />} />
                            <Route path="/marketing-tasks" element={<MarketingTasks />} />
                            <Route path="/marketing-insights" element={<MarketingInsights />} />
                            <Route path="/marketing/trafego-pago" element={<MarketingTrafegoPago />} />
                            <Route path="/insights" element={<Insights />} />
                            <Route path="/insights/:dashboardId" element={<Insights />} />
                            
                            <Route path="/admin" element={<Admin />} />
                            <Route path="/admin/whatsapp-diagnostics" element={<WhatsAppDiagnostics />} />
                            <Route path="/sales-scripts" element={<SalesScripts />} />
                            
                            <Route path="/rh" element={<RHDashboard />} />
                            <Route path="/rh/collaborators" element={<HRCollaborators />} />
                            <Route path="/rh/collaborators/:id" element={<HRCollaboratorProfile />} />
                            <Route path="/rh/org-chart" element={<OrgChart />} />
                            <Route path="/rh/departments" element={<RHDepartments />} />
                            <Route path="/rh/job-descriptions" element={<RHPositions />} />
                            <Route path="/rh/vacancies" element={<RHVagas />} />
                            <Route path="/rh/vacancies/new" element={<RHJobForm />} />
                            <Route path="/rh/vacancies/:id" element={<RHJobDetail />} />
                            <Route path="/rh/vacancies/:id/edit" element={<RHJobForm />} />
                            <Route path="/rh/service-providers" element={<HRServiceProviders />} />
                            <Route path="/rh/service-providers/:id" element={<HRServiceProviderProfile />} />
                            <Route path="/rh/partners" element={<HRPartners />} />
                            <Route path="/rh/partners/:id" element={<HRPartnerProfile />} />
                            
                          </Route>
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                    </SectorProvider>
                  </BrowserRouter>
                  </TooltipProvider>
            </PermissionsProvider>
          </ImpersonationProvider>
        </CurrentUserProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
