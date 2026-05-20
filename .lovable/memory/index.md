# Memory: index.md
Updated: now

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

### Financial
- [Payers & Cross-feed](mem://features/financial/payers-and-cross-feed-pt)
- [NFS-e Emission Notazz](mem://features/financial/nfse-emission-notazz-pt) — Sprint NF-1: contratadas + nfse_issuances + trigger on_payment + edge functions Notazz + página /financial/configuracoes/fiscal + EmitirNFButton

(Demais memórias preservadas — ver arquivos individuais em mem://)
