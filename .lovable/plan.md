

## Correção: Telefone principal não salva ao editar cliente

### Diagnóstico

O campo "Telefone principal" é editável no formulário `ClientInfoForm` e está presente no `editFormData.phone_e164`, porém a função `handleSaveClientInfo` em `src/pages/ClientDetail.tsx` **não inclui `phone_e164`** no objeto enviado ao banco de dados. Ou seja, o usuário altera o número, clica "Salvar", mas o campo simplesmente não é enviado na query de UPDATE.

### Causa raiz

Na linha 497 de `ClientDetail.tsx`, o objeto passado para `.update()` lista dezenas de campos, mas `phone_e164` foi omitido. O mesmo ocorre na atualização do estado local (linha 535).

### Solução

Adicionar `phone_e164` em dois pontos da função `handleSaveClientInfo`:

1. **No `.update()` do Supabase** (linha ~497-529): incluir `phone_e164: editFormData.phone_e164`
2. **No `setClient()` local** (linha ~535-568): incluir `phone_e164: editFormData.phone_e164`

### Detalhes técnicos

**Arquivo:** `src/pages/ClientDetail.tsx`

Alteração 1 -- Adicionar ao objeto de update do Supabase (depois de `full_name`):
```
phone_e164: editFormData.phone_e164,
```

Alteração 2 -- Adicionar ao `setClient()` local (depois de `full_name`):
```
phone_e164: editFormData.phone_e164,
```

Isso é uma correção simples de duas linhas. Nenhuma outra alteração é necessária pois o formulário já coleta e valida o telefone corretamente.
