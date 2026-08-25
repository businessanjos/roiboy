---
name: Produto ativo x histórico no cliente
description: client_products tem is_active/deactivated_at, apenas 1 produto ativo por cliente (trigger + índice único); filtros por produto e badge atual consideram só ativos
type: feature
---

`client_products` possui `is_active` (default true) e `deactivated_at`.

Regra de integridade no banco (não remover):
- Trigger `trg_enforce_single_active_client_product` (função `public.enforce_single_active_client_product`) desativa automaticamente os demais produtos do cliente quando um é marcado/inserido como ativo.
- Índice único parcial `client_products_one_active_per_client` em `(client_id) WHERE is_active` garante no máximo 1 produto ativo por cliente.
- Consequência: ao vincular um novo produto, ele passa a ser o ativo e o anterior vira histórico. A UI deve recarregar os vínculos após salvar em vez de assumir estado local.

Na ficha do cliente (CS), o diálogo "Editar Produtos" tem um Switch por produto vinculado para Ativo x Histórico.
Produtos em histórico continuam visíveis (opacidade/riscado + "(histórico)"), mas:
- o filtro por produto em `list-clients` usa `.eq("is_active", true)`;
- `getCurrentClientProduct` só considera inativos quando não há nenhum ativo.

Nunca usar delete-all + reinsert ao salvar produtos do cliente: remover só os desmarcados e inserir só os novos.
