

# Investigacao: Grupo "Financeiro Anjos" nao aparece para o Darlan

## Causa raiz identificada

O grupo **"Financeiro Anjos"** esta cadastrado no banco com `sector_id: diretoria` e `integration_id: 97a0aa1b-...`. Quando o Darlan busca na "Nova Conversa", ele esta logado em outro setor (ex: vendas ou operacoes). A busca de grupos no codigo aplica um filtro por `integration_id` ou `sector_id` do setor ativo:

```text
if (selectedIntegrationId) {
  query = query.eq("integration_id", selectedIntegrationId);   // filtra pela instancia
} else if (selectedSectorId) {
  query = query.eq("sector_id", selectedSectorId);             // filtra pelo setor
}
```

Como o Darlan nao esta no setor "diretoria", o grupo e excluido dos resultados. Para voce aparece normalmente porque voce esta acessando pelo setor/instancia correto.

## Solucao proposta

Remover o filtro de `integration_id`/`sector_id` **apenas na busca de grupos** dentro do dialog "Nova Conversa". Isso esta alinhado com a logica multi-setor de grupos ja implementada no sistema (conforme documentado: grupos suportam atendimento multi-setor e qualquer setor pode "puxar" um grupo via Nova Conversa).

## Alteracao tecnica

**Arquivo:** `src/pages/RoyZapp.tsx` (linhas ~3078-3097)

Remover as linhas que aplicam `.eq("integration_id", ...)` e `.eq("sector_id", ...)` na query de busca de grupos dentro do `searchContacts`. A query ficara apenas com os filtros de `account_id`, `is_group: true` e `ilike` no nome.

Isso permitira que qualquer usuario encontre qualquer grupo da conta ao pesquisar, independente do setor ativo. O isolamento de setor continuara sendo garantido no momento de **abrir/criar o assignment** do grupo (que ja associa ao setor correto do usuario), nao na etapa de busca.

