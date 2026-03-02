
## Adicionar campo "Conta Corrente Omie" (nCodCC) na integração

### Problema

A API do Omie exige o campo `nCodCC` (codigo da Conta Corrente cadastrada no Omie) para criar uma OS. Esse campo foi removido anteriormente porque estava com valor `0` (invalido). Agora precisamos permitir que o usuario configure o valor correto.

### Onde encontrar o nCodCC no Omie

No painel do Omie, acesse: **Finanças > Contas Correntes**. Cada conta listada possui um codigo numerico (ex: `11850365`). Esse e o valor que deve ser inserido no campo de configuracao.

### Alteracoes

**1. Migrar banco de dados** - Adicionar coluna `default_bank_account_code` na tabela `omie_settings`:
```sql
ALTER TABLE public.omie_settings ADD COLUMN default_bank_account_code text DEFAULT '';
```

**2. Arquivo: `src/components/integrations/OmieIntegrationTab.tsx`**
- Adicionar estado `defaultBankAccountCode`
- Carregar e salvar o novo campo
- Adicionar campo de input na UI abaixo do "Codigo da Categoria":
  - Label: "Conta Corrente (nCodCC)"
  - Placeholder: "Ex: 11850365"
  - Descricao: "Codigo numerico da conta corrente cadastrada no Omie (Financas > Contas Correntes). Obrigatorio."

**3. Arquivo: `supabase/functions/create-omie-os/index.ts`**
- Adicionar validacao: se `default_bank_account_code` estiver vazio, lancar erro amigavel
- Adicionar `nCodCC: Number(settings.default_bank_account_code)` dentro de `InformacoesAdicionais` no payload da OS
