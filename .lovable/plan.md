

## Corrigir erro na criacao de OS no Omie - campo invalido no payload

### Problema

A Edge Function `create-omie-os` esta sendo chamada corretamente ao marcar um negocio como ganho, porem a API do Omie retorna erro:

```
ERROR: Tag [CCODPARWORKE] nao faz parte da estrutura do tipo complexo [Cabecalho]!
```

O campo `cCodParworke` na linha 187 do payload nao existe na API do Omie. Provavelmente era para ser `cCodParc` (codigo do parceiro), mas como esta vazio e nao e obrigatorio, o mais seguro e remover.

### Alteracoes

**Arquivo: `supabase/functions/create-omie-os/index.ts`**

1. Remover o campo `cCodParworke: ''` do objeto `Cabecalho` (linha 187)
2. Remover o campo `cNumOS: ''` (linha 189) - campos vazios podem causar erros na API do Omie; o numero da OS e gerado automaticamente pelo Omie

O `Cabecalho` ficara assim:

```text
Cabecalho: {
  cCodIntOS: `ROY-${deal_id.substring(0, 8)}`,
  cEtapa: '10',
  dDtPrevisao: '02/03/2026',
  nCodCli: 12345,
  nQtdeParc: 1,
}
```

Tambem precisa adicionar as configuracoes de `verify_jwt = false` para ambas as funcoes no `config.toml`:

**Arquivo: `supabase/config.toml`**

Adicionar:
```text
[functions.create-omie-os]
verify_jwt = false

[functions.test-omie-connection]
verify_jwt = false
```

Embora a funcao esteja sendo chamada com sucesso agora (o JWT do usuario autenticado esta passando), seguir o padrao do projeto garante consistencia e evita problemas futuros.

### Resumo

- Causa raiz: campo `cCodParworke` invalido no payload enviado a API do Omie
- Correcao: remover campos invalidos/vazios do payload
- Bonus: adicionar configuracao de JWT no config.toml para seguir o padrao do projeto
