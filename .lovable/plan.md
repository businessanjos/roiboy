## Objetivo
Gerar um link público (sem login) da apresentação `/sales-team/incentive-presentation/slideshow` para mostrar a pessoas externas, incluindo o simulador de comissão funcional. Token revogável e com expiração.

## Fluxo do usuário
1. Em `/sales-team/incentive-presentation`, novo botão **"Gerar link externo"** (visível só para gestão).
2. Dialog gera/mostra o token e URL pública: `https://iamroy.app/external/incentive-plan/<token>`.
3. Permite revogar/renovar e definir expiração (padrão 30 dias).
4. Pessoa externa abre o link → vê os slides + simulador sem precisar logar.

## O que o link expõe (e o que NÃO expõe)
- Expõe: estrutura do plano vigente (faixas, multiplicadores, base de bônus, sem-teto, tri/anual, SPIFFs públicos, produtos com taxas para o simulador).
- Não expõe: vendedores, vendas reais, metas individuais, dashboards internos.

## Mudanças

### 1. Banco
Migration nova:
- `incentive_plan_share_links` (`id`, `account_id`, `plan_id` nullable, `token` único, `label`, `is_active`, `expires_at`, `created_by`, `view_count`, `last_viewed_at`, timestamps).
- RLS: apenas usuários do mesmo `account_id` com role de gestão (admin/management) podem CRUD.

### 2. Edge function (pública, verify_jwt=false)
`supabase/functions/public-incentive-plan/index.ts`:
- Valida token → checa `is_active`, expiração, incrementa `view_count`.
- Usa service role para buscar `incentive_plans`, `incentive_plan_tiers`, `incentive_plan_product_rates`, `incentive_plan_quotas`, `incentive_plan_spiffs` do `account_id` (plano executivo de vendas).
- Retorna JSON enxuto pro frontend.

### 3. Refatoração para reutilizar slides
- Extrair os 8 slides de `IncentivePresentation.tsx` para `src/components/sales/incentive/slides/*` (ou um único `IncentiveSlides.tsx` exportando os componentes).
- `IncentivePresentation.tsx` passa a importar dali (mantém comportamento atual).

### 4. Simulador público
- Criar `PublicCommissionSimulator.tsx`: versão enxuta do `CommissionSimulator` que aceita os dados via props (sem `useCurrentUser`/`useQuotasIncentives`), permite ajustar nº de vendas, mix de produto e formas de pagamento, e mostra o resultado em tempo real.
- Mantém os mesmos cálculos do simulador interno (faixa, sem teto, SPIFFs por método).

### 5. Página pública
`src/pages/public/PublicIncentivePresentation.tsx` em rota `/external/incentive-plan/:token`:
- Chama o edge function, renderiza estados (loading, inválido, expirado, ok).
- Usa os slides extraídos + `PublicCommissionSimulator`.
- Sem chrome do app (rota fora do `AppLayout`).

### 6. Botão de compartilhamento
- Novo `ShareIncentivePlanDialog` chamado por botão "Compartilhar externamente" no header de `/sales-team/incentive-presentation` (CloserDashboard).
- Permite criar link, copiar URL, definir expiração, revogar links existentes.

## Arquivos
- `supabase/migrations/<novo>.sql`
- `supabase/functions/public-incentive-plan/index.ts`
- `src/components/sales/incentive/IncentiveSlides.tsx` (extração)
- `src/components/sales/incentive/PublicCommissionSimulator.tsx`
- `src/components/sales/incentive/ShareIncentivePlanDialog.tsx`
- `src/pages/public/PublicIncentivePresentation.tsx`
- `src/pages/IncentivePresentation.tsx` (passa a usar slides extraídos)
- `src/pages/CloserDashboard.tsx` (botão "Compartilhar externamente")
- `src/App.tsx` (rota pública nova)

## Aceitação
- Link público abre em janela anônima, mostra todos os 8 slides e o simulador roda com os dados do plano vigente.
- Revogar o link no painel interno bloqueia o acesso imediatamente.
- Após `expires_at`, link mostra "Link expirado".
