import { lazy, Suspense, ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { NewVersionDialog } from "@/components/system/NewVersionDialog";
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

function reloadWithFreshAssets() {
  try {
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  } catch {
    // Best-effort cache clear only.
  }

  const url = new URL(window.location.href);
  url.searchParams.set("app_reload", Date.now().toString());
  window.setTimeout(() => window.location.replace(url.toString()), 0);
}

function LazyReloadFallback() {
  return <LoadingScreen message="Atualizando aplicação..." fullScreen={false} />;
}

// Retry wrapper for lazy imports to handle stale chunk errors after deploys
function lazyRetry<P extends object>(
  factory: () => Promise<{ default: ComponentType<P> }>,
  retries = 2
): React.LazyExoticComponent<ComponentType<P>> {
  const retryFactory = (attempt: number): Promise<{ default: ComponentType<P> }> =>
    factory()
      .then((mod) => {
        // Stale chunks after redeploy can resolve to a module without a
        // valid `default` export, which makes React.lazy throw
        // "Cannot read properties of undefined (reading 'default')".
        // Treat that as a chunk failure and retry / reload.
        if (!mod || typeof (mod as any).default === "undefined") {
          throw new Error("Lazy module missing default export (stale chunk?)");
        }
        return mod;
      })
      .catch((err) => {
        if (attempt > 0) {
          return new Promise<{ default: ComponentType<P> }>((resolve) => {
            setTimeout(() => resolve(retryFactory(attempt - 1)), 500);
          });
        }
        // Last resort: full page reload to get fresh asset manifest
        if (!sessionStorage.getItem("chunk-reload")) {
          sessionStorage.setItem("chunk-reload", "1");
          reloadWithFreshAssets();
        }
        return { default: LazyReloadFallback as ComponentType<P> };
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
const MedicalClients = lazyRetry(() => import("./pages/MedicalClients"));
const DoubleChairList = lazyRetry(() => import("./pages/DoubleChairList"));
const VipClients = lazyRetry(() => import("./pages/VipClients"));
const Renewals = lazyRetry(() => import("./pages/Renewals"));
const MentoriaEC = lazyRetry(() => import("./pages/MentoriaEC"));
const PracticeAreasAdmin = lazyRetry(() => import("./pages/PracticeAreasAdmin"));
const ConsultantBonus = lazyRetry(() => import("./pages/ConsultantBonus"));
const OperationsScripts = lazyRetry(() => import("./pages/OperationsScripts"));
const InstagramRanking = lazyRetry(() => import("./pages/InstagramRanking"));
const ClientDetail = lazyRetry(() => import("./pages/ClientDetail"));
const Integrations = lazyRetry(() => import("./pages/Integrations"));
const Settings = lazyRetry(() => import("./pages/Settings"));
const AccountSettings = lazyRetry(() => import("./pages/AccountSettings"));
const Products = lazyRetry(() => import("./pages/Products"));
const Events = lazyRetry(() => import("./pages/Events"));
const EventDetail = lazyRetry(() => import("./pages/EventDetail"));
const EventSuppliers = lazyRetry(() => import("./pages/EventSuppliers"));
const EventsCalendar = lazyRetry(() => import("./pages/events/EventsCalendar"));
const EventsInventory = lazyRetry(() => import("./pages/events/EventsInventory"));
const EventsPlaybooks = lazyRetry(() => import("./pages/events/EventsPlaybooks"));
const EventsKpis = lazyRetry(() => import("./pages/events/EventsKpis"));
// Team moved to Settings
const Tasks = lazyRetry(() => import("./pages/Tasks"));

const Notifications = lazyRetry(() => import("./pages/Notifications"));
const Forms = lazyRetry(() => import("./pages/Forms"));
const PublicForm = lazyRetry(() => import("./pages/PublicForm"));
const PublicCampaignForm = lazyRetry(() => import("./pages/PublicCampaignForm"));
const PublicRSVP = lazyRetry(() => import("./pages/PublicRSVP"));
const PublicEventRegistration = lazyRetry(() => import("./pages/PublicEventRegistration"));
const PublicEventFeedback = lazyRetry(() => import("./pages/PublicEventFeedback"));

const Admin = lazyRetry(() => import("./pages/Admin"));
const EventCheckin = lazyRetry(() => import("./pages/EventCheckin"));
const Onboarding = lazyRetry(() => import("./pages/Onboarding"));
const ClientOnboardingHub = lazyRetry(() => import("./pages/ClientOnboardingHub"));
const EternumAttendance = lazyRetry(() => import("./pages/operations/EternumAttendance"));
const ClinicaRyka = lazyRetry(() => import("./pages/ClinicaRyka"));

const TermsOfService = lazyRetry(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazyRetry(() => import("./pages/PrivacyPolicy"));
const DataDeletion = lazyRetry(() => import("./pages/DataDeletion"));

const SalesScripts = lazyRetry(() => import("./pages/SalesScripts"));
const Reminders = lazyRetry(() => import("./pages/Reminders"));
const PublicDigitalContract = lazyRetry(() => import("./pages/PublicDigitalContract"));
const ContractDefaultsSettings = lazyRetry(() => import("./pages/ContractDefaultsSettings"));
const SalesDigitalContracts = lazyRetry(() => import("./pages/SalesDigitalContracts"));
const SalesContractTemplates = lazyRetry(() => import("./pages/SalesContractTemplates"));

const RoyZapp = lazyRetry(() => import("./pages/RoyZapp"));
const RoyZappAttendanceMetrics = lazyRetry(() => import("./pages/RoyZappAttendanceMetrics"));
const EverIA = lazyRetry(() => import("./pages/EverIA"));
const GestaoTech = lazyRetry(() => import("./pages/GestaoTech"));
const LeaderMeetings = lazyRetry(() => import("./pages/LeaderMeetings"));

const BillingPortal = lazyRetry(() => import("./pages/BillingPortal"));
const Contracts = lazyRetry(() => import("./pages/Contracts"));
const SalesPipeline = lazyRetry(() => import("./pages/SalesPipeline"));
const SalesCalendar = lazyRetry(() => import("./pages/SalesCalendar"));
const SpiffsTracking = lazyRetry(() => import("./pages/SpiffsTracking"));
const IncentivePresentation = lazyRetry(() => import("./pages/IncentivePresentation"));
const CloserDashboard = lazyRetry(() => import("./pages/CloserDashboard"));
const SalesDashboard = lazyRetry(() => import("./pages/SalesDashboard"));
const CsIncentivePresentation = lazyRetry(() => import("./pages/CsIncentivePresentation"));
const Leads = lazyRetry(() => import("./pages/Leads"));

const Marketing = lazyRetry(() => import("./pages/Marketing"));
const ContentCalendar = lazyRetry(() => import("./pages/ContentCalendar"));
const MarketingContentHub = lazyRetry(() => import("./pages/marketing/MarketingContentHub"));
const MarketingCampaignsHub = lazyRetry(() => import("./pages/marketing/MarketingCampaignsHub"));
const MarketingProjectsHub = lazyRetry(() => import("./pages/marketing/MarketingProjectsHub"));
const MarketingIntelligenceHub = lazyRetry(() => import("./pages/marketing/MarketingIntelligenceHub"));
const MarketingProjectDetail = lazyRetry(() => import("@/components/marketing/projects/ProjectDetailSheet"));
const MarketingDashboard = lazyRetry(() => import("./pages/marketing/MarketingDashboard"));
const MarketingAgencyDetail = lazyRetry(() => import("./pages/marketing/MarketingAgencyDetail"));
const MarketingAgenciesCompare = lazyRetry(() => import("./pages/marketing/MarketingAgenciesCompare"));
const MarketingAgencyPortal = lazyRetry(() => import("./pages/marketing/MarketingAgencyPortal"));

const Insights = lazyRetry(() => import("./pages/Insights"));
const InsightsGoals = lazyRetry(() => import("./pages/InsightsGoals"));
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
const RHBenefits = lazyRetry(() => import("./pages/rh/RHBenefits"));
const RHOffers = lazyRetry(() => import("./pages/rh/RHOffers"));
const RHOfferWizard = lazyRetry(() => import("./pages/rh/RHOfferWizard"));
const RHAdmissions = lazyRetry(() => import("./pages/rh/RHAdmissions"));
const RHOffboarding = lazyRetry(() => import("./pages/rh/RHOffboarding"));
const RHTalentPool = lazyRetry(() => import("./pages/rh/RHTalentPool"));
const PublicJobOffer = lazyRetry(() => import("./pages/public/PublicJobOffer"));
const PublicExitInterview = lazyRetry(() => import("./pages/public/PublicExitInterview"));
const SharedInsights = lazyRetry(() => import("./pages/SharedInsights"));
const ExternalDashboard = lazyRetry(() => import("./pages/ExternalDashboard"));
const WhatsAppDiagnostics = lazyRetry(() => import("./pages/admin/WhatsAppDiagnostics"));
// Financial module with sub-routes (lazy loaded)
const FinancialLayout = lazyRetry(() => import("@/components/financial/FinancialLayout"));
const FinancialDashboardPage = lazyRetry(() => import("./pages/financial/FinancialDashboardPage"));
const FinancialCashFlowPage = lazyRetry(() => import("./pages/financial/FinancialCashFlowPage"));
const FinancialBankAccountsPage = lazyRetry(() => import("./pages/financial/FinancialBankAccountsPage"));
const FinancialBankAccountStatementPage = lazyRetry(() => import("./pages/financial/FinancialBankAccountStatementPage"));
const FinancialCategoriesPage = lazyRetry(() => import("./pages/financial/FinancialCategoriesPage"));
const FinancialCostCentersPage = lazyRetry(() => import("./pages/financial/FinancialCostCentersPage"));
const FinancialBudgetPage = lazyRetry(() => import("./pages/financial/FinancialBudgetPage"));
const FinancialCommissionsPage = lazyRetry(() => import("./pages/financial/FinancialCommissionsPage"));
const FinancialPaymentMethodsPage = lazyRetry(() => import("./pages/financial/FinancialPaymentMethodsPage"));
const FinancialPluggyStatusPage = lazyRetry(() => import("./pages/financial/FinancialPluggyStatusPage"));
const FinancialProvidersPortalPage = lazyRetry(() => import("./pages/financial/FinancialProvidersPortalPage"));
const FinancialFaqPage = lazyRetry(() => import("./pages/financial/FinancialFaqPage"));


// Hubs consolidados (cada um agrupa páginas antigas em abas)
const FinancialEntriesHubPage = lazyRetry(() => import("./pages/financial/FinancialEntriesHubPage"));
const FinancialReceivablesHubPage = lazyRetry(() => import("./pages/financial/FinancialReceivablesHubPage"));
const FinancialReconciliationHubPage = lazyRetry(() => import("./pages/financial/FinancialReconciliationHubPage"));
const FinancialCollectionsHubPage = lazyRetry(() => import("./pages/financial/FinancialCollectionsHubPage"));
const FinancialFiscalHubPage = lazyRetry(() => import("./pages/financial/FinancialFiscalHubPage"));
const FinancialPeopleHubPage = lazyRetry(() => import("./pages/financial/FinancialPeopleHubPage"));
const FinancialReportsHubPage = lazyRetry(() => import("./pages/financial/FinancialReportsHubPage"));

const PublicProviderPortal = lazyRetry(() => import("./pages/public/PublicProviderPortal"));
const PublicAdmissionPortal = lazyRetry(() => import("./pages/public/PublicAdmissionPortal"));
const PublicAgencyWeeklyReport = lazyRetry(() => import("./pages/public/PublicAgencyWeeklyReport"));

const PublicIncentivePresentation = lazyRetry(() => import("./pages/public/PublicIncentivePresentation"));
const PublicEventAlbum = lazyRetry(() => import("./pages/public/PublicEventAlbum"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 1,
      retryDelay: 1_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
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
                    <NewVersionDialog />
                    <BrowserRouter>
                      <SectorProvider>
                        <CompanyProvider>
                        <ImpersonationBanner />
                        <Suspense fallback={<PageLoader />}>
                          <Routes>
                            <Route path="/" element={<Navigate to="/setores" replace />} />
                          
                          <Route path="/auth" element={<Auth />} />
                          <Route path="/f/:formId" element={<PublicForm />} />
                          <Route path="/c/:slug" element={<PublicCampaignForm />} />
                          <Route path="/rsvp/:token" element={<PublicRSVP />} />
                          <Route path="/inscricao/:code" element={<PublicEventRegistration />} />
                          <Route path="/feedback/:eventId" element={<PublicEventFeedback />} />
                          <Route path="/checkin/:code" element={<EventCheckin />} />
                          <Route path="/shared/insights/:token" element={<SharedInsights />} />
                          <Route path="/external/insights" element={<ExternalDashboard />} />
                          <Route path="/vagas/:id/aplicar" element={<PublicJobApplication />} />
                          <Route path="/onboarding" element={<Onboarding />} />
                          <Route path="/contrato/:token" element={<PublicDigitalContract />} />
                          <Route path="/portal/prestador/:token" element={<PublicProviderPortal />} />
                          <Route path="/admissao/:token" element={<PublicAdmissionPortal />} />
                          <Route path="/relatorio-agencia/:token" element={<PublicAgencyWeeklyReport />} />

                          <Route path="/external/incentive-plan/:token" element={<PublicIncentivePresentation />} />
                          <Route path="/oferta/:token" element={<PublicJobOffer />} />
                          <Route path="/desligamento/saida/:token" element={<PublicExitInterview />} />
                          
                          <Route path="/termos" element={<TermsOfService />} />
                          <Route path="/terms-of-service" element={<TermsOfService />} />
                          <Route path="/privacidade" element={<PrivacyPolicy />} />
                          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                          <Route path="/data-deletion" element={<DataDeletion />} />
                          
                          <Route element={<AppLayout />}>
                            <Route path="/setores" element={<Sectors />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/dashboard/cadeira-dupla" element={<DoubleChairList />} />
                            <Route path="/clients" element={<Clients />} />
                            <Route path="/clients/medicos" element={<MedicalClients />} />
                            <Route path="/vips" element={<VipClients />} />
                            <Route path="/clients/new" element={<Clients />} />
                            <Route path="/clients/:id" element={<ClientDetail />} />
                            <Route path="/renewals" element={<Renewals />} />
                            <Route path="/operations/mentoria-ec" element={<MentoriaEC />} />
                            <Route path="/operations/practice-areas" element={<PracticeAreasAdmin />} />
                            <Route path="/operations/onboarding" element={<ClientOnboardingHub />} />
                            <Route path="/operations/presenca-eventos" element={<EternumAttendance />} />
                            <Route path="/operations/clinica-ryka" element={<ClinicaRyka />} />
                            <Route path="/operations/consultant-bonus" element={<ConsultantBonus />} />
                            <Route path="/operations/cs-incentive-presentation" element={<CsIncentivePresentation />} />
                            <Route path="/operations/scripts" element={<OperationsScripts />} />
                            <Route path="/operations/instagram-ranking" element={<InstagramRanking />} />
                            <Route path="/contracts" element={<Contracts />} />
                            <Route path="/settings/contract-defaults" element={<ContractDefaultsSettings />} />
                            <Route path="/sales/contracts" element={<SalesDigitalContracts />} />
                            <Route path="/sales/contracts/templates" element={<SalesContractTemplates />} />
                            <Route path="/sales/contracts/defaults" element={<ContractDefaultsSettings />} />
                            <Route path="/pipeline" element={<SalesPipeline />} />
                            <Route path="/sales-dashboard" element={<SalesDashboard />} />
                            <Route path="/sales-calendar" element={<SalesCalendar />} />
                            <Route path="/sales-team" element={<SalesTeam />} />
                            <Route path="/sales-team/spiffs" element={<SpiffsTracking />} />
                            <Route path="/sales-team/incentive-presentation" element={<CloserDashboard />} />
                            <Route path="/sales-team/incentive-presentation/slideshow" element={<IncentivePresentation />} />
                            <Route path="/leads" element={<Leads />} />
                            <Route path="/financial" element={<FinancialLayout />}>
                              <Route index element={<Navigate to="/financial/dashboard" replace />} />
                              <Route path="dashboard" element={<FinancialDashboardPage />} />
                              <Route path="cash-flow" element={<FinancialCashFlowPage />} />
                              <Route path="bank-accounts" element={<FinancialBankAccountsPage />} />
                              <Route path="bank-accounts/:id/extrato" element={<FinancialBankAccountStatementPage />} />
                              <Route path="categories" element={<FinancialCategoriesPage />} />
                              <Route path="cost-centers" element={<FinancialCostCentersPage />} />
                              <Route path="budget" element={<FinancialBudgetPage />} />
                              <Route path="commissions" element={<FinancialCommissionsPage />} />
                              <Route path="payment-methods" element={<FinancialPaymentMethodsPage />} />
                              <Route path="integracoes/pluggy" element={<FinancialPluggyStatusPage />} />
                              <Route path="prestadores" element={<FinancialProvidersPortalPage />} />
                              <Route path="ajuda" element={<FinancialFaqPage />} />


                              {/* Áreas consolidadas (hubs com abas) */}
                              <Route path="entries" element={<FinancialEntriesHubPage />} />
                              <Route path="recebiveis" element={<FinancialReceivablesHubPage />} />
                              <Route path="conciliacao" element={<FinancialReconciliationHubPage />} />
                              <Route path="cobranca" element={<FinancialCollectionsHubPage />} />
                              <Route path="notas-fiscais" element={<FinancialFiscalHubPage />} />
                              <Route path="pessoas" element={<FinancialPeopleHubPage />} />
                              <Route path="relatorios" element={<FinancialReportsHubPage />} />

                              {/* Rotas antigas → abas correspondentes */}
                              <Route path="recurring" element={<Navigate to="/financial/entries?tab=recorrentes" replace />} />
                              <Route path="invoices" element={<Navigate to="/financial/recebiveis?tab=faturas" replace />} />
                              <Route path="parcelas" element={<Navigate to="/financial/recebiveis?tab=parcelas" replace />} />
                              <Route path="boletos" element={<Navigate to="/financial/recebiveis?tab=boletos" replace />} />
                              <Route path="reconciliation" element={<Navigate to="/financial/conciliacao?tab=bancaria" replace />} />
                              <Route path="sales-reconciliation" element={<Navigate to="/financial/conciliacao?tab=vendas" replace />} />
                              <Route path="importar" element={<Navigate to="/financial/conciliacao?tab=importacoes" replace />} />
                              <Route path="alerts" element={<Navigate to="/financial/cobranca?tab=alertas" replace />} />
                              <Route path="regua-cobranca" element={<Navigate to="/financial/cobranca?tab=regua" replace />} />
                              <Route path="configuracoes/fiscal" element={<Navigate to="/financial/notas-fiscais?tab=configuracoes" replace />} />
                              <Route path="clientes-ativos" element={<Navigate to="/financial/pessoas?tab=clientes" replace />} />
                              <Route path="pagadores" element={<Navigate to="/financial/pessoas?tab=pagadores" replace />} />
                              <Route path="suppliers" element={<Navigate to="/financial/pessoas?tab=fornecedores" replace />} />
                              <Route path="dre" element={<Navigate to="/financial/relatorios?tab=dre" replace />} />
                              <Route path="aging" element={<Navigate to="/financial/relatorios?tab=aging" replace />} />
                              <Route path="profitability" element={<Navigate to="/financial/relatorios?tab=rentabilidade" replace />} />
                              <Route path="drf" element={<Navigate to="/financial/relatorios?tab=drf" replace />} />
                              <Route path="balance-sheet" element={<Navigate to="/financial/relatorios?tab=balanco" replace />} />
                            </Route>

                            <Route path="/products" element={<Products />} />
                            <Route path="/events" element={<Events />} />
                            <Route path="/events/calendar" element={<EventsCalendar />} />
                            <Route path="/events/inventory" element={<EventsInventory />} />
                            <Route path="/events/playbooks" element={<EventsPlaybooks />} />
                            <Route path="/events/kpis" element={<EventsKpis />} />
                            <Route path="/events/suppliers" element={<EventSuppliers />} />
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
                            <Route path="/roy-zapp/atendimentos" element={<RoyZappAttendanceMetrics />} />
                            <Route path="/ever-ia" element={<EverIA />} />
                            <Route path="/gestao-tech" element={<GestaoTech />} />
                            <Route path="/reuniao-lideres" element={<LeaderMeetings />} />
                            
                            <Route path="/billing" element={<BillingPortal />} />
                            
                            <Route path="/marketing" element={<Marketing />} />
                            <Route path="/marketing/dashboard" element={<MarketingDashboard />} />
                            <Route path="/content-calendar" element={<Navigate to="/marketing?tab=conteudo" replace />} />
                            <Route path="/social-media" element={<PreserveQueryRedirect to="/marketing/content-hq" params={{ tab: "redes" }} />} />
                            <Route path="/criacao" element={<Navigate to="/marketing/content-hq" replace />} />
                            <Route path="/marketing-tasks" element={<Navigate to="/marketing/projetos?tab=tarefas" replace />} />
                            <Route path="/marketing-insights" element={<MarketingIntelligenceHub />} />
                            <Route path="/marketing/trafego-pago" element={<MarketingCampaignsHub />} />
                            <Route path="/marketing/content-hq" element={<MarketingContentHub />} />
                            <Route path="/marketing/rebranding" element={<Navigate to="/marketing/projetos?tab=rebranding" replace />} />
                            <Route path="/marketing/projetos" element={<MarketingProjectsHub />} />
                            <Route path="/marketing/projetos/:id" element={<MarketingProjectDetail />} />
                            <Route path="/marketing/agencias" element={<Navigate to="/marketing/trafego-pago?tab=agencias" replace />} />
                            <Route path="/marketing/agencias/comparativo" element={<MarketingAgenciesCompare />} />
                            <Route path="/marketing/agencias/:id" element={<MarketingAgencyDetail />} />
                            <Route path="/marketing/portal-agencia" element={<MarketingAgencyPortal />} />
                            <Route path="/marketing/market-intelligence" element={<Navigate to="/marketing-insights?tab=market-intelligence" replace />} />
                            <Route path="/insights" element={<Insights />} />
                            <Route path="/insights/goals" element={<InsightsGoals />} />
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
                            <Route path="/rh/benefits" element={<RHBenefits />} />
                            <Route path="/rh/vacancies" element={<RHVagas />} />
                            <Route path="/rh/vacancies/new" element={<RHJobForm />} />
                            <Route path="/rh/vacancies/:id" element={<RHJobDetail />} />
                            <Route path="/rh/vacancies/:id/edit" element={<RHJobForm />} />
                            <Route path="/rh/service-providers" element={<HRServiceProviders />} />
                            <Route path="/rh/service-providers/:id" element={<HRServiceProviderProfile />} />
                            <Route path="/rh/partners" element={<HRPartners />} />
                            <Route path="/rh/partners/:id" element={<HRPartnerProfile />} />
                            <Route path="/rh/offers" element={<RHOffers />} />
                            <Route path="/rh/offers/new" element={<RHOfferWizard />} />
                            <Route path="/rh/offers/:id/edit" element={<RHOfferWizard />} />
                            <Route path="/rh/admissions" element={<RHAdmissions />} />
                            <Route path="/rh/offboarding" element={<RHOffboarding />} />
                            <Route path="/rh/resumes" element={<RHTalentPool />} />
                            
                            
                          </Route>
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                        </CompanyProvider>
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
