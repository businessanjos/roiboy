

## Resolver exibicao de "opt_1" nos formularios de Operacoes

### Problema

Quando uma cliente responde perguntas de selecao unica ou multipla nos formularios, o sistema armazena o valor interno da opcao (ex: `opt_1`, `opt_2`). Ao exibir as respostas no perfil do cliente, o componente `ClientFormResponses` mostra esse valor interno em vez do texto legivel (ex: "Todos geram bons leads.").

Isso acontece porque:
1. O fetch dos campos customizados na linha 91 busca apenas `id, name` -- nao busca `options` nem `field_type`
2. A funcao `formatValue` (linha 163) simplesmente converte o valor para string, sem tentar resolver o label da opcao

### Solucao

Alterar o componente `ClientFormResponses.tsx` para:

1. **Buscar dados completos dos campos**: Alterar a query de `custom_fields` para incluir `options` e `field_type` alem de `id` e `name`
2. **Criar um mapa de resolucao de opcoes**: Construir um mapa que, dado um `fieldId` e um `value` (ex: `opt_1`), retorne o `label` correspondente
3. **Atualizar `formatValue`**: Receber o `fieldId` como parametro e, para campos do tipo `select` ou `multi_select`, resolver os valores para seus labels antes de exibir

### Mudancas tecnicas

**Arquivo: `src/components/client/ClientFormResponses.tsx`**

| Local | Mudanca |
|-------|---------|
| Linha 68 (state) | Alterar tipo do `customFieldsMap` para armazenar `{name, options, field_type}` em vez de apenas `name` |
| Linhas 89-96 (fetch) | Buscar `id, name, options, field_type` dos custom_fields |
| Linha 159-161 (getFieldLabel) | Adaptar para novo formato do mapa |
| Linhas 163-169 (formatValue) | Receber `fieldId`, resolver valores de opcao para labels usando o mapa de opcoes |
| Linha 246 (render) | Passar `fieldId` para `formatValue` |

A logica de resolucao sera:
- Para campos `select`: verificar se o valor (ex: `opt_1`) existe nas opcoes do campo e retornar o `label`
- Para campos `multi_select`: verificar se o valor e um array, resolver cada item para seu label
- Para campos `boolean`: manter a logica existente de "Sim"/"Nao"
- Para demais tipos: manter o comportamento atual

