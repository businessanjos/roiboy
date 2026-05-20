# Project Memory

## Core
- UI: Vertical sidebar for complex navigation (no horizontal tabs). Global header has avatar (name only), gear, notifications.
- Data Access: Use `useCurrentUser` for user auth context (avoids RLS errors). Use `auth_user_id` for DB audit fields.
- DB Schema: `clients.emails` is an array. Client photo is `logo_url`. User full name is `users.name`.
- RBAC: Finance has full Client CRUD. Admins and Ops 'mentor' are unrestricted. Fallback logic manually checks `team_role_id`.
- Contracts: Terminal and Suspended statuses demand a Reason & Justification. 'Suspenso' (Amber) and 'Pausado' (Blue) are distinct.
- Loss Reasons: Selecting 'Outro' explicitly requires a text description format "Outro: [descrição]".
- Sales Pipelines: The 'Repescagem' funnel is permanently removed. Never recreate or re-add its routing logic.
- WhatsApp Compliance: Avoid bans. Require variable text, limit to 30-40 msgs/hr, block identical mass broadcasting.
- Exceptions: User `m.quintana@me.com` has no trial banner and exclusive access to the HR sector.
- Product Badges: Sempre exibir produto em tabelas/listas como Badge colorida usando `products.color` (SELECT inclui color, fallback #6b7280, nunca cinza genérico).
- Open Finance: Pluggy é o integrador padrão (substitui banco.mcp.ai). Edge functions `pluggy-*`, dialog `PluggyConnectDialog`, discriminador `bank_accounts.openfinance_provider`.
- NFS-e: Emissão via Notazz (`NOTAZZ_API_KEY`). Edge `nfse-issue`/`nfse-webhook`, config em `/financial/configuracoes/fiscal`, componente `<EmitirNFButton>`.

## Memories

### Architecture & Auth
- [Global Header UI](mem://architecture/global-header-and-identity-pt) — Fixed header, simple user avatar, settings gear, clearSector on logo
- [User Data Fetching](mem://architecture/user-data-fetching-pattern-pt) — `useCurrentUser` for safe auth context and `auth_user_id` for audits
- [Client DB Schema Details](mem://architecture/database/client-data-structure-pt) — `emails` is array, `logo_url` for images, user `name` parsing quirks
- [RBAC Permissions logic](mem://auth/logica-de-permissao-e-navegacao-v3) — Multi-layer permission checks, Finance CRUD access, `team_role_id` fallbacks
- [Cross-team Data Visibility](mem://auth/data-visibility-decisions-pt) — Explicit allowance of supplier financial and client diagnostic data internally
- [Specific User Exceptions](mem://auth/user-exceptions-pt) — No trial banner and exclusive HR access for m.quintana@me.com
- [Admin API Keys](mem://auth/admin-api-keys-v1-pt) — SHA-256 hashed API keys for external endpoints dual-auth
- [Sales RBAC Restrictions](mem://auth/rbac-sales-roles-restrictions-pt) — Hides specific Settings and Management tabs for sales roles
- [Management Role Gating](mem://auth/management-role-gating-pt) — `isManagementUser` helper para gatear dashboards executivos (Sales Dashboard, etc.)
- [Team Roles Taxonomy](mem://features/team/structured-role-taxonomy-v2-pt) — Area, Job, Seniority structuring with multiple roles per user
- [Lead Product Matching](mem://architecture/lead-to-product-matching-v2-pt) — Prioritizes high price, skips renewals to assign correct UUIDs dynamically
- [RoyZapp Infrastructure](mem://architecture/roy-zapp-infrastructure-v2-pt) — Security audits, connection status prioritization, RLS isolation
- [WhatsApp Routing Logic](mem://architecture/whatsapp-routing-and-fallback-v1) — Uses `integration_id` > `sector_id`, with strict connection status prioritization
- [Event System Rules](mem://architecture/unified-events-system-v6-goals-and-ui) — TBD dates, hybrid modalities, goals tracking, large UI formats
- [RSVP Automation](mem://architecture/rsvp-automation-and-data-integrity) — SECURITY DEFINER triggers for RSVP risk/roi events to bypass RLS
- [Stage Duration Tracking](mem://architecture/deal-stage-duration-tracking-pt) — Automated `stage_changed_at` tracking for pipeline stagnation metrics

### Sales & Pipeline
- [Multi-Pipeline Validation](mem://features/sales/multi-pipeline-system-pt) — Ensures every deal has a `pipeline_id` explicitly selected or auto-filled
- [Pipeline Persisted UI Filters](mem://features/sales/pipeline-ui-and-bi-logic-pt) — LocalStorage persistence for filters and explicit Deal ID resolution on webhook
- [Repescagem Funnel Ban](mem://features/sales/repescagem-removal-pt) — Complete permanent removal of Repescagem routing logic and pipelines
- [Dual Responsibles](mem://features/sales/dual-responsible-system-sales-and-operations) — `sales_user_id` for conversion vs `responsible_user_id` for ops triage
- [Won Deal Mapping](mem://features/sales/won-deal-mapping-and-lifecycle) — Maps won deals to client contracts, removes from Kanban view
- [Upsell Deal Workflow](mem://features/sales/upsell-registration-workflow-pt) — Immediate registration of upsells to 'won' status in Closer pipeline
- [Deal Loss Reasons](mem://features/sales/loss-reasons) — Mandatory text description for "Outro", restricted deletion for admins/Jonathan
- [MQL Qualification Logic](mem://features/sales/mql-qualification-logic) — Revenue thresholds, 5 specific segments, medical specialties parsing
- [Sales Item Sync Logic](mem://features/sales/item-venda-sync-logic-pt) — Auto-resolution to Product UUIDs and mandatory price list synchronization
- [Sales Scripts & Playbooks](mem://features/sales/script-and-playbook-area-pt) — RBAC rules for SDR/Closer playbook access and DB constraints
- [Conversation Analysis](mem://features/sales/conversation-analysis-dashboard-pt) — AI-driven response time metrics and objection scoring via Gemini
- [Daily.co Video Workflow](mem://features/sales/video-meeting-workflow-v6-pt) — Browser tab audio recording limits (25MB) for Whisper AI analysis
- [Call Analysis Attribution](mem://features/sales/call-analysis-attribution-pt) — Links video analyses directly to pipeline deals for traceability
- [Champion Call System](mem://features/sales/champion-call-system-pt) — Dashboard for ICP modeling, AI call comparison, and closer rankings
- [SDR Sector Workflow](mem://features/sales/sdr-sector-workflow) — SDR autonomy, split attribution (`sdr_user_id` vs `responsible_user_id`) for commission
- [Sales Goals System](mem://features/sales/goals/company-and-individual-system-pt) — Annual company rollups and specific BRL Super Goals for SDRs/Closers
- [Sales Team Hierarchy](mem://features/sales/team/management-and-hierarchy-pt) — Fixed horizontal layout for specific members (Everton, Jonathan, Maikol, etc.)
- [Sales Team Insights AI](mem://features/sales/team/insights-ai-pipeline-pt) — GPT/Gemini pipelines for team and isolated individual performance feedback
- [Commission System](mem://features/sales/commission/system-v10-pt) — Distinct Closer vs SDR models, clearing records pre-calculation for data consistency
- [TV View Sales Ranking](mem://features/sales/ranking-presentation-mode-v2-pt) — Brand colors, dashboards, privacy blur modes for presentation screens
- [Contract Templates by Product](mem://features/sales/contract-templates-pt) — Per-product templates with `{{KEY}}` placeholders, autofill from client/deal/company
- [Fixed Contratada Data](mem://features/sales/contract-fixed-contratada-data-pt) — Eternum Mentoring Club Ltda, hardcoded no template
- [Contract Wizard Autofill](mem://features/sales/contract-autofill-pt) — Autofill no wizard com produto como default e deal sobrescrevendo
- [Roulette Async Approval](mem://features/sales/roulette-async-approval-pt) — Vendedor solicita giro, gestor aprova/rejeita em /sales-team/spiffs

### Clients & Contracts
- [VIP Crown Indicator](mem://features/client/vip-crown-indicator-pt) — Coroa âmbar via `<VipBadge clientId>`
- [Timezone Detection](mem://features/client/timezone-detection-pt) — Cascata DDD > UF > DDI, override manual em `clients.timezone`
- [Contract Lifecycle Statuses](mem://features/contracts/status-lifecycle) — Mandatory reasons for terminal statuses
- [Contract List Filter](mem://features/client/contract-filter-logic-pt) — Server-side logic for urgent/warning expirations
- [Renewals Management](mem://features/operations/renewals-management-pt) — Semi-automated tracking of 90-day expiries
- [Renewal Successor Detection](mem://features/operations/renewal-successor-detection-pt) — Auto-hides expired contracts when same client+product has active successor
- [Merge Clients & Deals](mem://features/client/record-merging-systems-v2-pt) — Consolidates duplicate profiles and negotiations
- [Deep Client Linking](mem://features/client/deep-linking-shared-data-v1-pt) — Share timeline/deals/contracts via `sync_data` toggle
- [Timeline Persistence](mem://features/client/timeline-history-persistence-pt) — Uncapped timeline history
- [Client Ops Table Columns](mem://features/client/operations-table-columns-pt) — Fixed UI order: Product > Graduation > Area
- [Onboarding Automation](mem://features/onboarding/workflow-and-automation-pt) — Auto-advancement and task generation
- [Operation Briefing Form](mem://features/operations/operation-briefing-form-pt) — Structured form replacing free-text "Informação para Operação"
- [Overdue Badge in Operations](mem://features/operations/overdue-badge-pt) — Badge de inadimplência em /clients
- [Onboarding Hub](mem://features/operations/onboarding-hub-pt) — Página /operations/onboarding com jornada completa

### RoyZapp & WhatsApp Integration
- [RoyZapp Routing & Visibility](mem://features/roy-zapp/routing-and-visibility-v1) — Global admin queue vs assigned agent queue
- [RoyZapp Sync Engine](mem://features/roy-zapp/state-and-sync-engine-v1) — Realtime reactive sync, media auto-download
- [RoyZapp Data Resolution](mem://features/roy-zapp/data-resolution-and-quotes-v1) — Suffix matching for quotes/mentions
- [RoyZapp Conversation Badges](mem://features/roy-zapp/conversation-ui-metadata-pt) — Strict exclusion of manual tags from list UI
- [RoyZapp Instance Linking](mem://features/roy-zapp/instance-sector-linking-pt) — Free text naming for instances
- [RoyZapp Playbook Multi-send](mem://features/roy-zapp/playbook-multi-send-pt) — Sequential sending of items with 1-300s delays
- [WhatsApp Spam Prevention](mem://features/roy-zapp/spam-prevention-and-compliance-pt) — Limits on broadcast scale
- [Meta Webhook Limitation](mem://integrations/whatsapp/meta-api-webhook-limitation-pt) — Single webhook URL limit bypass
- [Meta Cloud API Strategy](mem://integrations/whatsapp/meta-cloud-api-strategy-pt) — Parallel routing layer

### Insights, BI & Finance
- [Conversion Rate BI](mem://features/insights/conversion-rate-calculation) — Real win rate calculation
- [Stacked Bar Chart Logic](mem://features/insights/stacked-bar-chart-v2-pt) — Handling comma-separated values
- [Dashboard View Modes](mem://product/dashboard-gestao-modos-de-view-e-integridade) — Ops (full) vs Commercial (simplified) toggles
- [Dashboard Contract Metrics](mem://product/dashboard-contract-metrics-pt) — Separation of 'Suspenso' (Amber) and 'Pausado' (Blue) metrics
- [Cancellation Analytics](mem://features/dashboard/cancellation-analytics-modal) — Restricted UUID-based access to churn metrics
- [AI Cancellation Analysis](mem://features/dashboard/cancellation-ai-analysis-pt) — Gemini qualitative analysis of churn
- [Shared Dashboards Scale](mem://features/insights/shared-dashboard-links-v3-pt) — Zoom-based CSS scaling
- [Insights External Access](mem://features/insights/external-access-credentials-pt) — Password-protected viewer panels
- [Financial Reconciliation](mem://features/financial/reconciliation-usability-pt) — Mandatory client/origin display
- [Financial Sidebar Layout](mem://style/navigation/financial-sidebar-unification-v2-pt) — Main sidebar unification
- [ROY Financial Roadmap](mem://features/financial/roy-financial-roadmap-pt) — Blueprint multi-CNPJ + Pagador separado + parcelas imutáveis
- [Tributário & Contador](mem://features/financial/tax-and-accountant-pt) — Área /financial/tributario com regime, contador e alertas de IA
- [Portal de Prestadores](mem://features/financial/providers-portal-pt) — Link público /portal/prestador/:token para envio mensal de NF + dados bancários
- [Payers & Cross-feed](mem://features/financial/payers-and-cross-feed-pt) — Pagadores (CRUD /financial/pagadores + PayerSelector + ensure_payer_from_client), quitação automática de contrato, write-off por cancelamento, badge "pronto p/ renovar"
- [NFS-e Emission Notazz](mem://features/financial/nfse-emission-notazz-pt) — Emissão NFS-e via Notazz: contratadas + nfse_issuances, trigger on_payment, edge functions nfse-issue/nfse-webhook, página /financial/configuracoes/fiscal, componente EmitirNFButton

### HR (Recursos Humanos)
- [HR Departments Structure](mem://features/rh/departments-structure) — Fixed list of depts
- [HR Collaborator Profiles](mem://features/rh/collaborator-profile) — CLT vs Sócio
- [HR Org Chart Rules](mem://features/rh/org-chart) — Ranking (0=CEO, 1=Head, 2=Other)
- [HR Recruitment Portals](mem://features/rh/recruitment-vacancies) — Kanban application tracking
- [HubDev CPF Integration](mem://features/rh/hubdev-integration) — Edge function population of Name, DOB, Status
- [HR Service Providers (PJ)](mem://features/rh/service-providers-management-pt) — Separation from employees
- [Payroll Inactive Exclusion](mem://features/rh/payroll-inactive-exclusion-pt) — Status `inactive` sempre excluído

### UI, Forms & General Architecture
- [Sidebar Navigation Pattern](mem://style/universal-sidebar-navigation-pattern-pt) — Vertical sub-navigation
- [Sidebar Visual Layout](mem://style/sidebar-visual-layout-v2-pt) — Simplified layout
- [Product Badge Color Rule](mem://style/product-badge-color-rule-pt) — Toda exibição de produto usa Badge colorida
- [Custom Fields Isolation](mem://features/custom-fields/core-system-v4-sector-isolation-and-types) — Strict flags
- [Task Sector Isolation](mem://features/tasks/sector-isolation-and-query-limits-pt) — Server-side filtering
- [Public Form Architecture](mem://features/public-form/core-architecture-v2-pt) — Sophisticated dark wizard
- [Products Core Architecture](mem://features/products/core-system-v2-pt) — BRL float logic, 'is_renewal' tags
- [Bonuses by Product](mem://features/products/bonuses-by-product-pt) — `product_bonuses` table + `BonusSelector`
- [Contracts Storage Policies](mem://infrastructure/storage/contracts-bucket-policies-pt) — Account-restricted RLS rules

### Events & Integrations
- [Pluggy Banking](mem://integrations/pluggy-banking-pt) — Open Finance via widget Pluggy + edge functions pluggy-* substituindo banco.mcp.ai
- [Event Lifecycle](mem://features/events/lifecycle-and-status-locking) — Completed/Cancelled events lock UI
- [Custom RSVP Forms](mem://features/events/customizable-rsvp-forms) — JSONB custom form fields
- [Typeform/n8n Ingestion](mem://integrations/n8n-typeform-api-endpoints) — Edge functions for lead creation
- [Google Calendar No-Show Sync](mem://integrations/calendar/no-show-sync) — Auto-syncs red calendar events
- [Omie Identity Matching](mem://integrations/omie/client-identity-validation-pt) — CPF/CNPJ and Name cross-validation
- [Omie Financial Bridge Page](mem://integrations/omie/financial-bridge-page-pt) — Página /financial/integracoes/omie
- [YouTube Analytics Sync](mem://features/marketing/youtube-integration-pt) — Tracking videos/shorts/lives
- [Content HQ](mem://features/marketing/content-hq-pt) — Área /marketing/content-hq Bruna+Everton, multi-plataforma, IA gera estratégia/pautas/briefings
- [External REST API](mem://integrations/external-rest-api-v1-pt) — `x-api-key` protected CRUD endpoints
- [Clinica Ryka Integration](mem://integrations/clinica-ryka-sync-v2-pt) — Bidirectional sync
- [Ryka Onboarding Provisioning](mem://integrations/clinica-ryka-onboarding-provisioning-pt) — Botão no ClientOnboardingDrawer
- [3C Plus Telephony](mem://integrations/telephony/3c-plus-v3-pt) — UI integration
- [Ever IA Lead Sync](mem://integrations/ever-ia/api-lead-sync-v1-pt) — Pipeline ingestion
