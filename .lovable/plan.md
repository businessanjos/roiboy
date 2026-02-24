
## Adicionar campo Instagram na exportacao de clientes

### Problema
O botao "Exportar" na aba Clientes do setor Operacoes gera CSV/XLSX sem o campo Instagram do cliente. Essa informacao existe no perfil do cliente (campo `instagram` na tabela `clients`) mas nao e buscada pela Edge Function `list-clients` nem mapeada na funcao de exportacao.

### Solucao

Duas alteracoes simples:

#### 1. Edge Function `supabase/functions/list-clients/index.ts`
- Adicionar o campo `instagram` na query SELECT (junto dos outros campos como `emails`, `cpf`, `cnpj`, `notes`)

#### 2. Pagina `src/pages/Clients.tsx`
- Na funcao `exportClients`, adicionar a coluna **"Instagram"** no mapeamento de rows (linha ~449), extraindo `client.instagram || ""`
- A coluna sera posicionada apos "Email" para manter a ordem logica dos dados de contato

### Resultado esperado
- O arquivo exportado (CSV e XLSX) tera uma coluna "Instagram" com o handle do cliente
- Para clientes sem Instagram cadastrado, o campo vira vazio
