
## Correcao: Arquivo desaparece e nome com numeros no WhatsApp

### Problema 1: "Falha ao enviar midia" (arquivo desaparece)

**Causa raiz**: A Edge Function `uazapi-manager` retorna a resposta no formato `{ data: <resposta_uazapi> }`. O frontend verifica `data.success`, mas como `success` nao existe no nivel superior do objeto retornado, a condicao `!data.success` e sempre `true`, lancando o erro falso "Falha ao enviar midia" -- mesmo quando o envio foi bem-sucedido.

Fluxo atual:
```text
uazapi-manager retorna: { data: { ...resposta_do_whatsapp... } }
Frontend recebe:        data = { data: { ...resposta_do_whatsapp... } }
Frontend verifica:      data.success -> undefined -> !undefined = true -> ERRO
```

**Correcao**: Ajustar a verificacao no frontend (`src/pages/RoyZapp.tsx` linha ~2030) para verificar `data.error` em vez de `!data.success`:

```typescript
// DE:
if (data && !data.success) {
  throw new Error(data.message || "Falha ao enviar midia");
}

// PARA:
if (data?.error) {
  throw new Error(data.error || "Falha ao enviar midia");
}
```

### Problema 2: Nome com numeros no WhatsApp do destinatario

**Causa raiz**: O arquivo e salvo no storage com o path `{timestamp}_{nome}.xlsx`. Quando o UAZAPI faz download pela URL, ele extrai o nome do arquivo da propria URL, ignorando o parametro `fileName` do payload. Resultado: o destinatario recebe `1770677986305_Teste123.xlsx`.

**Correcao**: Mudar a estrutura do path no storage para colocar o timestamp em uma subpasta, mantendo o nome original limpo no final da URL:

```typescript
// DE:
const fileName = `${currentUser!.account_id}/${Date.now()}_${safeName}`;

// PARA:
const fileName = `${currentUser!.account_id}/${Date.now()}/${safeName}`;
```

Assim a URL terminara com `/Teste123.xlsx` e o UAZAPI usara esse nome corretamente.

### Alteracoes no webhook

Atualizar o regex de protecao de filename no webhook (`supabase/functions/uazapi-webhook/index.ts` linha ~1369) para tambem ignorar nomes que sao apenas timestamps (o formato antigo pode ainda aparecer em mensagens existentes):

```typescript
// Regex mais abrangente: ignora nomes puramente numericos COM ou SEM underscore
media_filename: (mediaFilename && /^\d+[\._]/.test(mediaFilename)) ? null : (mediaFilename || null),
```

Porem, como agora o URL terminara com o nome correto, o UAZAPI deve retornar o nome correto no webhook, tornando o regex menos necessario. Manter como protecao extra.

### Resumo de arquivos alterados

1. **src/pages/RoyZapp.tsx**: Corrigir verificacao de erro (linha ~2030) e path de upload (linha ~1990)
2. **supabase/functions/uazapi-webhook/index.ts**: Ajustar regex de protecao de filename (linha ~1369)
