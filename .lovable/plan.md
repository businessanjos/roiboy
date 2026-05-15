
## Objetivo
Cada conversa do RoyZapp passa a ter um **dono claro** (consultor responsável), o cliente sabe **com quem está falando** (assinatura no topo de toda mensagem) e a gestão consegue medir **quem fez o quê**.

A visibilidade continua aberta — todo mundo vê tudo e qualquer um pode responder. A diferença é que agora cada mensagem fica marcada com o autor, e cada conversa tem um responsável visível.

---

## 1. Identificação ao cliente (assinatura)

Toda mensagem enviada por um humano sai com cabeçalho:

```
*Maria Souza | Eternum*
[texto da mensagem]
```

- Vale para **texto, legenda de mídia, áudio (legenda do encaminhamento), template** (quando o template tiver corpo livre).
- Mensagens **automáticas** (boas-vindas, playbook) e **encaminhamentos de áudio cru sem caption** ficam sem assinatura.
- Templates Meta com variáveis fixas **não** ganham prefixo (Meta rejeita modificação do corpo).
- Toggle por consultor em `Configurações > Preferências`: "Adicionar assinatura nas mensagens" (ligado por padrão).
- O nome usado é `users.name`. "Eternum" sai fixo (no futuro pode virar nome do setor).

## 2. Atribuição híbrida (cliente fixo + lead manual)

Reaproveita a tabela existente `zapp_conversation_assignments` (já tem `agent_id`, `status`, `assigned_at`).

Regra na criação de uma conversa nova (`uazapi-webhook` e `meta-webhook`):

1. Se a conversa for vinculada a um `client_id` que tem `responsible_user_id` → cria assignment automático para esse usuário, status `active`.
2. Se for lead novo (sem cliente/sem responsável) → fica **sem dono**, status `unassigned`, aparece numa fila "Sem dono" no topo da lista.

Ações na UI:
- Botão **"Pegar conversa"** (em conversas sem dono) → cria assignment para o usuário atual.
- Botão **"Transferir"** (em conversas com dono) → escolhe outro consultor, registra em `zapp_transfers` (já existe).
- Qualquer um pode responder mesmo sem ser dono — o envio fica registrado em `sender_user_id`, mas o **dono da conversa** não muda automaticamente.

Visualização:
- Avatar pequeno do dono no canto da linha da conversa (lista lateral).
- Badge "Sem dono" em âmbar para fila aberta.

## 3. Histórico: quem enviou cada mensagem

`zapp_messages.sender_user_id` já existe e já é gravado nos envios via UI. Vamos:

- Garantir gravação também em: envio de template (Meta), playbook multi-send, áudio, mídia.
- Na bolha de saída exibir, em letrinha pequena acima do texto: avatar (16px) + primeiro nome do consultor.
- Hover/tap mostra nome completo e horário.

## 4. Métricas por consultor

Nova aba **"Atendimentos"** em `/roy-zapp` (ou card no topo do dashboard de operações), com os indicadores dos últimos 7/30 dias por consultor:

- Conversas atendidas (distinct conversation_id onde sender_user_id = X)
- Mensagens enviadas
- Tempo médio de 1ª resposta (usa `first_response_at` do assignment)
- Conversas atualmente em aberto sob responsabilidade
- Ranking simples por mensagens enviadas

Gráfico de linha simples com volume diário, tabela ordenável.

---

## Arquivos / mudanças técnicas

### Banco
- `zapp_conversations`: nada novo (assignment vive em `zapp_conversation_assignments`).
- `users`: novo campo `zapp_signature_enabled boolean default true`.
- Trigger `auto_assign_conversation_on_create()` em `zapp_conversations` (AFTER INSERT): se `client_id` tem `responsible_user_id` e usuário tem `zapp_agents` ativo, insere assignment ativo.

### Edge functions
- `uazapi-manager` e `meta-manager` (envio): aplicar prefixo de assinatura no `text` quando `add_signature !== false` no payload e o usuário tiver `zapp_signature_enabled=true`. Resolver nome via `users.name` do `userData` já carregado.
- Garantir `sender_user_id` no insert em `zapp_messages` (template e mídia).

### Frontend
- `src/components/royzapp/MessageBubble.tsx` (ou equivalente): mostrar autor humano em bolhas outbound.
- `src/components/royzapp/ConversationListItem.tsx`: avatar do dono + badge "Sem dono".
- Novo componente `ClaimConversationButton` + `TransferConversationButton`.
- Novo `src/pages/RoyZappAttendanceMetrics.tsx` + rota `/roy-zapp/atendimentos` com filtro de período e tabela.
- `Settings > Preferências` → toggle `zapp_signature_enabled`.

---

## Sequência de entrega

1. **Banco + assinatura no envio** (toggle + prefixo em uazapi/meta) — efeito imediato na percepção do cliente.
2. **Autor por bolha + dono visível na lista** (UI).
3. **Atribuição automática + botões pegar/transferir + fila "sem dono"**.
4. **Aba de métricas por consultor**.

Posso começar pelo passo 1 já. Confirma a sequência ou quer reordenar?
