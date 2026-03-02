

## Corrigir campo obrigatorio cCodCateg na criacao de OS do Omie

### Problema

A API do Omie retorna o erro:
```
É obrigatório informar o código da Categoria, tag [cCodCateg], na inclusão!
```

O campo `cCodCateg` dentro de `InformacoesAdicionais` esta sendo enviado como string vazia, mas e obrigatorio na API do Omie para inclusao de OS.

### Solucao

Adicionar um campo de configuracao "Codigo da Categoria" na tela de configuracoes do Omie (similar ao "Codigo do Servico Padrao" que ja existe), salvar no banco e usar no payload da Edge Function.

### Alteracoes

**1. Migrar banco de dados** - Adicionar coluna `default_category_code` na tabela `omie_settings`:
```sql
ALTER TABLE omie_settings ADD COLUMN default_category_code text DEFAULT '';
```

**2. Arquivo: `src/components/integrations/OmieIntegrationTab.tsx`**
- Adicionar estado `defaultCategoryCode`
- Carregar o valor de `data.default_category_code` no `loadSettings`
- Incluir `default_category_code` no payload do `handleSave`
- Adicionar campo de input na UI, abaixo do "Codigo do Servico Padrao":
  - Label: "Codigo da Categoria"
  - Placeholder: "Ex: 1.01.02"
  - Descricao: "Codigo da categoria financeira usada na OS (obrigatorio)."

**3. Arquivo: `supabase/functions/create-omie-os/index.ts`**
- Na linha 194, trocar `cCodCateg: ''` por `cCodCateg: settings.default_category_code || ''`
- Adicionar validacao antes de chamar a API: se `default_category_code` estiver vazio, lancar erro amigavel: "Codigo da Categoria nao configurado nas configuracoes do Omie."

### Resultado

- O usuario configura o codigo da categoria uma unica vez nas configuracoes
- A Edge Function valida antes de chamar a API, evitando erros silenciosos
- O campo e exibido ao lado do campo de servico que ja existe, mantendo consistencia visual
