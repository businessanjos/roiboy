import { auth, defineMcp } from "@lovable.dev/mcp-js";
import telephonyCalls from "./tools/telephony-calls";
import salesDeals from "./tools/sales-deals";
import salesGoalsCommissions from "./tools/sales-goals-commissions";
import zappConversations from "./tools/zapp-conversations";
import zappMessages from "./tools/zapp-messages";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "roy-eternum",
  title: "ROY ETERNUM",
  version: "0.1.0",
  instructions:
    "Ferramentas de análise comercial do ROY ETERNUM. Use `telephony_calls` para ligações da 3C Plus, `sales_deals` para o pipeline de negócios, `sales_goals_commissions` para metas e comissões, e `zapp_conversations` + `zapp_messages` para o atendimento no RoyZapp. Todas as ferramentas são somente leitura e respeitam as permissões do usuário conectado. Datas no formato YYYY-MM-DD.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [telephonyCalls, salesDeals, salesGoalsCommissions, zappConversations, zappMessages],
});
