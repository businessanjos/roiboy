---
name: Produto ativo x histórico no cliente
description: client_products tem is_active/deactivated_at; filtros por produto e badge atual consideram apenas produtos ativos
type: feature
---

`client_products` possui `is_active` (default true) e `deactivated_at`.

- Na ficha do cliente (CS), o diálogo "Editar Produtos" tem uma seção com Switch por produto vinculado para marcar Ativo x Histórico.
- Produtos em histórico continuam visíveis (badge com opacidade/riscado + "(histórico)"), mas:
  - o filtro por produto em `list-clients` usa `.eq("is_active", true)`;
  - `getCurrentClientProduct` só considera inativos quando não há nenhum ativo.
- Nunca usar delete-all + reinsert ao salvar produtos do cliente: remover só os desmarcados e inserir só os novos, para preservar o status.
