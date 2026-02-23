

## Corrigir aba Fichas vazia e adicionar edicao de formularios

### Problema identificado

O formulario "Cadastro Empresarial" preenchido por Matheus Krey existe no banco de dados (ID: `7e826cad-...`), mas o campo `client_id` esta **NULL**. A query da aba Fichas filtra por `client_id`, entao o formulario nao aparece. Isso afeta 7 de 19 respostas na conta.

### Causa raiz

A Edge Function `submit-form-response` tenta vincular respostas ao cliente por telefone, mas a normalizacao de telefone falha silenciosamente em alguns cenarios (ex: formatos inesperados, espacos extras, ou a query nao retorna por timing). Quando o vinculo falha, a resposta e salva com `client_id = NULL` e fica "orfã".

### Solucao em 3 partes

#### 1. Vincular a resposta do Matheus Krey (e outras orfas) via migracao SQL

Executar um UPDATE para vincular form_responses orfas aos clientes correspondentes pelo telefone normalizado:

- Atualizar `client_id` na resposta `7e826cad-...` para `5dc0ec45-...` (Matheus Krey)
- Executar um UPDATE generico para tentar vincular TODAS as respostas orfas que tem `client_phone` correspondente a um cliente existente na mesma conta

#### 2. Melhorar a Edge Function `submit-form-response`

Tornar a busca por telefone mais robusta:

- Alem da busca exata por `phone_e164`, fazer uma busca secundaria comparando apenas os ultimos 8-9 digitos do telefone. Isso resolve problemas de formatacao e prefixo inconsistente
- Adicionar logs mais detalhados para diagnosticar futuras falhas de vinculacao
- Buscar tambem em `additional_phones` do cliente

#### 3. Adicionar funcionalidade de edicao na aba Fichas (`ClientFormResponses.tsx`)

Implementar edicao inline dos formularios preenchidos:

- Adicionar botao "Editar" em cada card de resposta expandido
- Ao clicar em Editar, os campos de texto mudam para inputs editaveis (text, textarea, select conforme o tipo do campo)
- Botoes "Salvar" e "Cancelar" aparecem
- Ao salvar, atualizar o registro `form_responses.responses` no banco via Supabase
- Manter o historico: adicionar campo `last_edited_at` e `last_edited_by` na tabela para rastreabilidade

### Arquivos alterados

- **Migracao SQL**: UPDATE para vincular respostas orfas + adicionar colunas `last_edited_at` e `last_edited_by` na tabela `form_responses`
- **`supabase/functions/submit-form-response/index.ts`**: Melhorar logica de normalizacao e busca por telefone
- **`src/components/client/ClientFormResponses.tsx`**: Adicionar modo de edicao inline com formulario dinamico baseado no tipo de cada campo

### Resultado esperado

- A resposta do Matheus Krey (e outras orfas) aparece imediatamente na aba Fichas
- Futuras respostas serao vinculadas corretamente mesmo com variacoes de formato de telefone
- Usuarios podem editar respostas de formularios diretamente na aba Fichas
