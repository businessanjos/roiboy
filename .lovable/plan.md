

## Corrigir campo invalido no payload InformacoesAdicionais da API Omie

### Problema

A API do Omie retorna o erro:
```
Tag [CDADOSADICIONAIS] nao faz parte da estrutura do tipo complexo [InformacoesAdicionais]!
```

Segundo a documentacao oficial do Omie, o campo correto dentro de `InformacoesAdicionais` e `cDadosAdicNF`, nao `cDadosAdicionais`.

### Alteracao

**Arquivo: `supabase/functions/create-omie-os/index.ts`**

Na linha 193, trocar:
```text
cDadosAdicionais: descricao || `Negocio: ${deal.title}`,
```
Por:
```text
cDadosAdicNF: descricao || `Negocio: ${deal.title}`,
```

### Referencia

Payload correto conforme documentacao oficial do Omie (https://ajuda.omie.com.br/pt-BR/articles/6891433):

```text
"InformacoesAdicionais": {
    "cCidPrestServ": "SAO PAULO (SP)",
    "cCodCateg": "1.01.02",
    "cDadosAdicNF": "OS incluida via API",
    "nCodCC": 3731356020
}
```

### Impacto

- Correcao de uma unica linha
- Nenhuma mudanca no frontend
- Retrocompativel

