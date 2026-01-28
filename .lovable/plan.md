
# Plano: Adicionar "Mentoria com o Everton" às Atividades de Operações

## Contexto

Os tipos de atividade são gerenciados na tabela `activity_types` do banco de dados e filtrados por setor via `sector_id`. O setor de Operações (`operacoes`) já possui os seguintes tipos:

| Tipo | Ícone | Cor |
|------|-------|-----|
| Onboarding | users | #0ea5e9 (sky) |
| Implementação da Clínica Ryka | calendar | #8b5cf6 (violet) |
| Implementação das Ferramentas de IA | calendar | #14b8a6 (teal) |
| Suporte de Ferramentas | wrench | #f59e0b (amber) |
| Back office | briefcase | #6366f1 (indigo) |
| Apresentação do Plano de Ação | presentation | #10b981 (emerald) |
| Alinhamento ou Reunião | users | #f59e0b (amber) |

## Ação

Inserir um novo registro na tabela `activity_types`:

| Campo | Valor |
|-------|-------|
| name | Mentoria com o Everton |
| sector_id | operacoes |
| icon | users |
| color | #0ea5e9 (sky-500, similar a Mentoria existente) |
| display_order | 18 |
| is_active | true |
| account_id | 21a69ee1-a7fc-49e6-b61d-871ff50235b8 |

## Migração SQL

```sql
INSERT INTO activity_types (
  account_id,
  name,
  icon,
  color,
  description,
  is_active,
  display_order,
  sector_id
) VALUES (
  '21a69ee1-a7fc-49e6-b61d-871ff50235b8',
  'Mentoria com o Everton',
  'users',
  '#0ea5e9',
  'Sessão de mentoria com o Everton',
  true,
  18,
  'operacoes'
);
```

## Resultado Esperado

Após a migração, o dropdown de "Tipo de Atividade" no setor de Operações exibirá a nova opção "Mentoria com o Everton" junto com as demais.

## Nenhuma alteração de código necessária

A lógica de exibição já está implementada:
- `useActivityTypes(sectorId)` filtra por `sector_id`
- `TaskDialog.tsx` usa o hook com `effectiveSectorId`
- O novo tipo aparecerá automaticamente após a inserção no banco
