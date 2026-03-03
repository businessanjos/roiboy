

## Correção: Campo `cCodServLC116` obrigatório na API do Omie

### Problema
O erro **"É obrigatório o Código do Serviço LC116, tag [cCodServLC116], na inclusão!"** indica que a API do Omie exige o campo `cCodServLC116` (código do serviço conforme a Lei Complementar 116) no bloco `ServicosPrestados`. Atualmente o payload envia apenas `cCodServMun` (código municipal), mas falta o `cCodServLC116`.

### O que é o cCodServLC116?
É o código padronizado nacional do serviço (ex: `14.01`, `17.01`). Em muitos casos é o mesmo valor do código municipal, mas é um campo separado e obrigatório.

### Correção

1. **Edge Function `create-omie-os`** — Adicionar o campo `cCodServLC116` no bloco `ServicosPrestados`, usando o mesmo valor de `default_service_code` das configurações:

```typescript
ServicosPrestados: [
  {
    cCodServLC116: settings.default_service_code || '',  // NOVO
    cCodServMun: settings.default_service_code || '',
    cDescServ: deal.title,
    cTribServ: settings.default_tax_type || '01',
    nQtde: 1,
    nValUnit: valor,
  },
],
```

2. **Validação** — Adicionar validação antes da chamada à API para garantir que o código do serviço foi preenchido:

```typescript
if (!settings.default_service_code) {
  throw new Error('Código do Serviço não configurado nas configurações do Omie.');
}
```

Mudança pontual, apenas na edge function. Sem alteração de banco ou UI.

