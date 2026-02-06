
# Diagnóstico e Correção: Áudios Carregando Infinitamente no ROY zAPP

## Resumo do Problema

Os usuários do ROY zAPP veem **"Carregando mídia..."** indefinidamente para mensagens de áudio recebidas. O áudio nunca é reproduzível.

---

## Causa Raiz Identificada

### A Edge Function `download-media` NÃO ESTÁ DEPLOYADA

Ao testar a função:
```
POST /download-media → 404 NOT_FOUND
"Requested function was not found"
```

O código da função existe em `supabase/functions/download-media/index.ts`, mas ela não foi implantada no ambiente de produção.

### Fluxo do Problema

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Webhook recebe mensagem de áudio                                         │
│    ↓                                                                         │
│ 2. Salva no banco com media_download_status = "pending"                     │
│    ↓                                                                         │
│ 3. Frontend abre conversa, vê "pending", tenta chamar download-media        │
│    ↓                                                                         │
│ 4. ❌ Edge Function retorna 404 (não deployada)                             │
│    ↓                                                                         │
│ 5. Status permanece "pending" eternamente                                   │
│    ↓                                                                         │
│ 6. UI mostra "Carregando mídia..." para sempre                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Evidência dos Dados

Consulta no banco mostra dezenas de mensagens de áudio pendentes:
- Todas têm `media_download_status: pending`
- Todas têm `media_key` corretamente salva (ex: `LLf4lZ4s9w2E+qRg0l...`)
- Todas têm `media_encrypted_url` presente
- Nenhuma tem `media_url` (URL final acessível)

---

## Solução

### Ação 1: Deploy da Edge Function `download-media`

A função já existe e está correta. Apenas precisa ser deployada:

```bash
supabase functions deploy download-media
```

### Ação 2: Melhorar Resiliência do Frontend (Preventivo)

Atualmente, se o download falha, o frontend não tenta novamente automaticamente. Vou adicionar:

1. **Detecção de mídia travada**: Se status é "pending" ou "downloading" há mais de 60 segundos na mesma sessão, oferecer botão "Tentar novamente"

2. **Tratamento de erro 404**: Se a função retorna 404, logar erro claro no console

**Arquivo**: `src/hooks/useZappData.tsx`

Modificar a chamada de auto-download (linhas 665-667) para:
```typescript
supabase.functions.invoke("download-media", {
  body: { message_ids: idsToDownload }
}).then((res) => {
  if (res.error) {
    console.error("[ZappData] Download-media error:", res.error);
  } else {
    console.log(`[ZappData] Download triggered for ${idsToDownload.length} items`);
  }
}).catch((err) => {
  console.error("[ZappData] Auto-download network error:", err);
});
```

### Ação 3: Reprocessar Mídias Pendentes (Pós-Deploy)

Após o deploy, testar manualmente para verificar que as mídias pendentes serão baixadas quando o usuário abrir a conversa.

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/download-media/index.ts` | **DEPLOY** (sem alterações no código) |
| `src/hooks/useZappData.tsx` | Melhorar log de erros no auto-download |

---

## Por Que o Deploy Foi Perdido?

Possíveis causas:
1. Durante um deploy anterior de outras funções (ex: `uazapi-manager`), esta função não foi incluída
2. Algum processo de limpeza removeu funções não utilizadas recentemente
3. Erro silencioso durante um deploy batch

### Prevenção Futura

As seguintes Edge Functions são **CRÍTICAS** para o funcionamento do sistema e devem ser verificadas periodicamente:

| Função | Propósito |
|--------|-----------|
| `uazapi-manager` | Envio de mensagens WhatsApp |
| `uazapi-webhook` | Recebimento de mensagens WhatsApp |
| `download-media` | Download de mídias (áudio, imagem, vídeo) |
| `list-clients` | Listagem de clientes |
| `create-client` | Criação de clientes |
| `transcribe-audio` | Transcrição de áudios |

---

## Resultado Esperado

Após o deploy:

1. Usuário abre conversa com áudio pendente
2. Frontend detecta `media_download_status: pending`
3. Chama `download-media` Edge Function
4. Função baixa, descriptografa e salva no Storage
5. Atualiza `media_url` e `media_download_status: completed`
6. Realtime notifica frontend
7. UI atualiza e exibe player de áudio funcional

---

## Notas Técnicas

### A função `download-media` é robusta

Ela já possui:
- Timeout de 30s por download individual
- Processamento em lotes de 8 mensagens
- Descriptografia com AES-CBC usando HKDF
- Detecção de downloads "travados" (>5min no status "downloading")
- Suporte a retry de falhas
