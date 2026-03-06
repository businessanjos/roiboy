

## Plano: Corrigir seleção de telefone adicional e busca no ROY zAPP

### Problemas identificados

**1. Telefone adicional abre conversa do número principal**

Dois locais causam isso:

- **`createConversationFromUrl`** (linha 403-414): Quando o usuário seleciona o telefone adicional na página `/leads`, a URL é construída corretamente com `newPhone=553195564347`. A busca por telefone (linha 351) não encontra conversa existente para esse número. Então o fallback na linha 403 busca por `lead_id` e encontra a conversa existente do telefone principal. Resultado: abre a conversa do número principal.

- **`createConversationWithContact`** (linha 3544-3560): Mesma lógica. Quando o contato vem da busca "Nova Conversa" com ID `${leadId}-alt-0`, o fallback por `lead_id` usa esse ID modificado (que não existe no banco), então não encontra nada — nesse caso funciona. Mas quando vem de `createConversationFromUrl`, o `leadId` é o ID real do lead.

**Correção**: No fallback por `lead_id`/`client_id`, quando não encontrou conversa pelo telefone, **não** devemos redirecionar para outra conversa do mesmo lead. Se o telefone é diferente, devemos criar uma nova conversa para aquele telefone específico. Remover ou condicionar o fallback por ID em ambos os locais.

**Arquivo: `src/pages/RoyZapp.tsx`**

- Linha 403-414 (`createConversationFromUrl`): Remover o fallback por `lead_id`/`client_id`. Se não encontrou conversa pelo telefone, deixar `zappConvId = null` para que o fluxo crie uma nova conversa.
- Linha 3544-3560 (`createConversationWithContact`): Mesma correção — remover o fallback por ID. Quando o contato tem um `id` com `-alt-`, extrair o ID real do lead para vincular corretamente na nova conversa, mas não buscar conversas existentes por esse ID.
- Linha 3533: Ao vincular `lead_id`, extrair o ID real removendo o sufixo `-alt-X`: `const realId = contact.id.includes('-alt-') ? contact.id.split('-alt-')[0] : contact.id;`

**2. Busca por nome não mostra telefones adicionais**

O código de expansão client-side (linhas 3172-3179) já adiciona entradas para `additional_phones`. Porém o limite da query é `10` (linha 3097). Se existem muitos leads com o nome "Teste", os 10 slots são preenchidos antes do lead específico aparecer, e seus telefones adicionais nunca são expandidos.

**Correção**: Aumentar o limit de `10` para `20` na query de leads (linha 3097) para garantir que mais leads sejam retornados e seus telefones adicionais expandidos.

### Arquivos alterados
- `src/pages/RoyZapp.tsx` — remover fallback por lead_id em ambas as funções; extrair ID real de leads `-alt-`; aumentar limit da query de busca

