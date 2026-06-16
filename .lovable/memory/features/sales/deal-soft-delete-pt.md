---
name: Deal Soft Delete
description: Exclusão suave de Negócios (deals) com filtro "Excluído" em Insights e drawer de restauração para admins
type: feature
---
# Soft-delete em Negócios (deals)

## Schema
- `deals.deleted_at` (timestamptz, nullable) — quando marcou como excluído.
- `deals.deleted_by` (uuid → auth.users) — quem excluiu.
- Índices: `idx_deals_deleted_at` (partial WHERE NOT NULL) e `idx_deals_account_deleted`.

## Comportamento padrão
Toda query que lê `deals` deve **esconder** registros com `deleted_at IS NOT NULL`, exceto quando o usuário explicitamente pediu para vê-los.

Pontos onde isso já está aplicado:
- `src/hooks/useDeals.tsx` → `fetchDeals` filtra `.is('deleted_at', null)` (pipeline nunca mostra).
- `src/hooks/useVisualData.ts` → `fetchDealsData`, `getLeadIdsByDealConstraints`.
- `src/hooks/useStackedVisualData.ts`.
- `src/hooks/useVisualDrilldown.ts` (query principal e secundária por lead_id).
- `src/hooks/useMapVisualData.ts`.

Helper central: `src/lib/sales/dealDeletedFilter.ts` (`applyDeletedFilter`, `DELETED_STATUS_VALUE = 'deleted'`).

## Excluir / Restaurar
- `useDeals.deleteDeal` faz UPDATE `{ deleted_at, deleted_by }` (não DELETE).
- `useDeals.restoreDeal` zera `deleted_at` / `deleted_by`.
- Drawer admin: `src/components/sales/DeletedDealsDrawer.tsx` (lista + Restaurar + Purga definitiva). Botão "Excluídos" no header do `/pipeline` aparece apenas para `isManagementUser` / super admin.

## Filtro nos Insights
Em `DealFieldFilterSection.tsx` há a opção `Excluído` no bloco "Status do Negócio". É **gated** por `isManagementUser` + super admin (ops/sales não veem).

Semântica do filtro (em `applyDeletedFilter`):
- `['deleted']` sozinho → mostra somente deals excluídos.
- `['deleted', 'won', ...]` → mostra excluídos **OU** com os status selecionados (`.or()`).
- Sem `deleted` → esconde excluídos (`deleted_at IS NULL`).

## Regras
- Hard delete só pode acontecer via "Purgar" no drawer (admin) — confirma com `confirm()`.
- Histórico anterior à migration foi perdido (eram hard deletes antes).
- Quem pode usar/ver: admin / super_admin / cargos de gestão (Head, Diretor, C-level, Sócio, etc).
