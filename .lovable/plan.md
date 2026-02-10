

## Diagnostico: Imagens nao exibidas no ROY

### Causa Raiz

Foram identificados **dois problemas distintos**:

**Problema 1 - Bolhas completamente vazias (33 mensagens):**
Existem 33 mensagens de imagem no banco onde `media_download_status` e `NULL` (nao "pending") e `media_url` tambem e NULL. O componente `ZappMessageBubble` so mostra o indicador "Carregando midia..." quando o status e exatamente `"pending"`. Quando o status e `null`, nenhum indicador visual aparece, resultando em bolhas vazias sem conteudo visivel.

**Problema 2 - Imagens permanentemente pendentes (3.343 mensagens):**
Ha 3.343 mensagens de imagem com status "pending" que nunca foram baixadas. O sistema atual so baixa automaticamente **3 imagens** por vez quando uma conversa e aberta. As URLs encriptadas do WhatsApp (`mmg.whatsapp.net/...*.enc`) expiram apos algumas horas/dias, tornando essas midias **irrecuperaveis** apos esse prazo.

### Numeros atuais no banco

| Status | Quantidade |
|--------|-----------|
| completed | 1.828 |
| pending | 3.343 |
| NULL (sem status) | 33 |
| failed | 2 |

### Plano de Solucao

#### 1. Corrigir bolhas vazias no componente (ZappMessageBubble)

Alterar a condicao de exibicao do indicador de "carregando midia" para incluir mensagens onde `media_download_status` e `null` mas `media_type` existe e `media_url` esta ausente. Isso garante que mesmo mensagens com status nulo mostrem o placeholder visual correto com botao "Tentar novamente".

**Arquivo:** `src/components/royzapp/ZappMessageBubble.tsx`

- Na secao de "Media loading states" (linhas 367-398), adicionar a condicao `!message.media_download_status` como fallback para exibir o placeholder de midia pendente com o botao "Tentar novamente", em vez de mostrar uma bolha vazia.

#### 2. Corrigir dados inconsistentes no banco

Executar uma migracao SQL para normalizar as 33 mensagens com `media_download_status = NULL` que possuem `media_type` mas nao tem `media_url`, definindo o status como `"pending"` para que o sistema de auto-download possa processa-las.

#### 3. Aumentar o limite de auto-download

Alterar o limite de auto-download de 3 para **5** imagens por conversa aberta (em `src/hooks/useZappData.tsx`), equilibrando custo e experiencia do usuario. Isso reduz a chance de imagens ficarem em fila por muito tempo antes que as URLs expirem.

#### 4. Melhorar auto-download no webhook (preventivo)

No webhook (`supabase/functions/uazapi-webhook/index.ts`), verificar se ja existe logica para tentar baixar a midia imediatamente durante a ingestao quando a URL direta (nao-encriptada) esta disponivel. Se o UAZAPI fornece uma URL publica direta (`permanentMediaUrl`), ela ja e usada. O problema e que muitas midias so vem com URL encriptada, que precisa de processamento posterior.

### Resumo das alteracoes

| Arquivo | Alteracao |
|---------|----------|
| `src/components/royzapp/ZappMessageBubble.tsx` | Tratar `media_download_status = null` como pendente para exibir placeholder visual |
| `src/hooks/useZappData.tsx` | Aumentar auto-download de 3 para 5 por conversa |
| Migracao SQL | Normalizar 33 registros com status NULL para "pending" |

