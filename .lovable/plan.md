
## Corrigir Exportacao de Clientes: Campos Vazios e Limite de 200

### Problemas Identificados

1. **Email vazio**: A coluna no banco se chama `emails` (plural), mas o codigo usa `client.email` (singular).
2. **CPF e CNPJ vazios**: A Edge Function `list-clients` nao inclui as colunas `cpf`, `cnpj`, `emails` e `notes` na query SELECT -- esses campos nunca chegam ao frontend.
3. **Limite de 200 registros**: A Edge Function limita o maximo a 200 por requisicao (`Math.min(limit, 200)`), e a funcao de exportacao faz apenas uma chamada. Para exportar todos os clientes, e necessario paginar.

---

### O que sera feito

#### 1. Atualizar a Edge Function `list-clients`

Adicionar os campos `emails`, `cpf`, `cnpj` e `notes` na query SELECT da Edge Function para que esses dados sejam retornados ao frontend.

```text
SELECT atual:
  id, full_name, phone_e164, status, created_at, company_name, tags, avatar_url, responsible_user_id, client_products(...)

SELECT atualizado:
  id, full_name, phone_e164, status, created_at, company_name, tags, avatar_url, responsible_user_id, emails, cpf, cnpj, notes, client_products(...)
```

#### 2. Corrigir mapeamento no export (Clients.tsx)

- Trocar `client.email` por `client.emails` (extrair o primeiro email do array, se for array, ou usar como string).
- Os campos `cpf`, `cnpj` e `notes` funcionarao automaticamente apos a correcao da Edge Function.

#### 3. Implementar exportacao paginada para buscar TODOS os clientes

Na funcao `exportClients`, em vez de usar o array `clients` ja carregado (limitado a 200), fazer chamadas paginadas diretamente a Edge Function para buscar todos os registros que atendam aos filtros atuais:

```text
Fluxo:
1. Mostrar toast "Preparando exportacao..."
2. Loop de requisicoes com offset incrementado de 200 em 200
3. Continuar ate receber menos registros que o limite (indica fim)
4. Concatenar todos os resultados
5. Gerar o arquivo CSV ou XLSX com todos os dados
```

Os filtros ativos (busca, responsavel, produto, V-NPS, contrato, status) serao passados em cada requisicao paginada, garantindo que a exportacao reflita exatamente o que o usuario ve na tela.

---

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/list-clients/index.ts` | Adicionar `emails, cpf, cnpj, notes` ao SELECT |
| `src/pages/Clients.tsx` | Corrigir `client.email` para `client.emails`; implementar fetch paginado na exportacao |
