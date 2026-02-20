

## Corrigir check constraint na tabela user_integrations

### Causa raiz

A tabela `user_integrations` possui um CHECK constraint que restringe os valores da coluna `provider` a apenas `'google'` e `'zoom'`:

```sql
CHECK (provider = ANY (ARRAY['google', 'zoom']))
```

Quando a edge function tenta inserir um registro com `provider = '3cplus'`, o banco de dados rejeita a operacao com o erro:

```
new row for relation "user_integrations" violates check constraint "user_integrations_provider_check"
```

### Correcao

Executar uma migracao SQL para alterar o CHECK constraint, adicionando `'3cplus'` como valor permitido:

```sql
ALTER TABLE public.user_integrations
  DROP CONSTRAINT user_integrations_provider_check;

ALTER TABLE public.user_integrations
  ADD CONSTRAINT user_integrations_provider_check
  CHECK (provider = ANY (ARRAY['google', 'zoom', '3cplus']));
```

### Arquivos envolvidos

- **Migracao SQL** - Alterar o CHECK constraint da tabela `user_integrations`
- Nenhum arquivo de codigo precisa ser alterado; a edge function ja esta correta

