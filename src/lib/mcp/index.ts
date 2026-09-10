import { auth, defineMcp } from "@lovable.dev/mcp-js";
import telephonyCalls from "./tools/telephony-calls";
import salesDeals from "./tools/sales-deals";
import salesGoalsCommissions from "./tools/sales-goals-commissions";
import zappConversations from "./tools/zapp-conversations";
import zappMessages from "./tools/zapp-messages";
import clientsPortfolio from "./tools/clients-portfolio";
import clientSuccessActivity from "./tools/client-success-activity";
import financialOverview from "./tools/financial-overview";
import hrOverview from "./tools/hr-overview";
import marketingOverview from "./tools/marketing-overview";
import eventsOverview from "./tools/events-overview";
import tasksOverview from "./tools/tasks-overview";
import productsOverview from "./tools/products-overview";
import auditOverview from "./tools/audit-overview";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "roy-eternum",
  title: "ROY ETERNUM",
  version: "1.0.0",
  instructions:
    "Ferramentas de análise de todas as áreas do ROY ETERNUM: vendas, telefonia, RoyZapp, clientes e contratos, Customer Success, financeiro, RH, marketing, eventos, produtos, tarefas e auditoria gerencial. Todas são estritamente somente leitura, usam a identidade do usuário conectado e respeitam RLS, conta e acesso setorial. Não solicite dados fora da permissão do usuário. Datas no formato YYYY-MM-DD.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    telephonyCalls,
    salesDeals,
    salesGoalsCommissions,
    zappConversations,
    zappMessages,
    clientsPortfolio,
    clientSuccessActivity,
    financialOverview,
    hrOverview,
    marketingOverview,
    eventsOverview,
    tasksOverview,
    productsOverview,
    auditOverview,
  ],
});
