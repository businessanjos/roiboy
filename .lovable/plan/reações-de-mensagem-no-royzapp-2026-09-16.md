# Reações de mensagem no RoyZapp

Hoje, quando alguém reage a uma mensagem no WhatsApp, o ROY simplesmente descarta o aviso: nada é guardado e nada aparece na conversa. Vamos passar a mostrar as reações e permitir reagir pelo próprio ROY.

## O que muda para quem usa

- O emoji da reação aparece colado embaixo do balão da mensagem, com o nome de quem reagiu ao passar o mouse.
- Se a mesma mensagem receber vários emojis, aparecem todos, cada um com a contagem.
- Ao passar o mouse sobre uma mensagem, surge um botão de carinha: escolhe o emoji e ele é enviado como reação para o WhatsApp do contato.
- Clicar de novo no emoji que você mandou remove a reação (no WhatsApp também).
- Se a pessoa trocar ou remover a reação dela, a conversa se atualiza sozinha, sem recarregar.
- Reações antigas (anteriores a esta mudança) não podem ser recuperadas; vale a partir de agora.

## Detalhes técnicos

**Banco**
- Nova tabela `public.zapp_message_reactions`: `id`, `account_id`, `zapp_conversation_id`, `zapp_message_id` (FK para `zapp_messages`, on delete cascade), `external_message_id` (id da mensagem alvo no WhatsApp, para casar quando a linha ainda não existe), `emoji text`, `reactor_phone`, `reactor_name`, `reactor_user_id`, `from_me boolean`, `reacted_at`, `created_at`.
- Índice único por (`zapp_message_id`, `reactor_phone`) — uma reação por pessoa por mensagem; trocar o emoji faz upsert, remover apaga a linha (payload com emoji vazio).
- GRANTs (`authenticated` select/insert/delete, `service_role` all) + RLS espelhando as policies de `zapp_messages` (mesma conta / mesma conversa visível).
- Adicionar a tabela à publicação de realtime com `REPLICA IDENTITY FULL`.

**Webhook (`supabase/functions/uazapi-webhook/index.ts`)**
- Substituir o early-return de reação (bloco "3. Skip reactions") por um handler dedicado: extrair `reaction.text` (emoji), o id da mensagem alvo (`reaction.key.id` / `reaction.id` / `msg.quoted*` conforme o formato do UAZAPI), o telefone/nome de quem reagiu e `fromMe`.
- Resolver `zapp_message_id` por `external_message_id` + `account_id`; se não achar, gravar mesmo assim com `external_message_id` para casar depois.
- Emoji vazio = remoção → `delete`. Caso contrário, upsert na chave única.
- Nenhuma alteração no fluxo de mensagens normais nem nos ACKs.

**Envio (`supabase/functions/uazapi-manager/index.ts`)**
- Nova ação `send_reaction`: valida `conversation_id`, `external_message_id`, `emoji` (string vazia = remover), resolve instância/token pela mesma lógica das ações `send_text`, chama o endpoint de reação do UAZAPI e grava/apaga a linha local com `from_me = true` e `reactor_user_id` do usuário autenticado.

**Frontend**
- Hook `useZappMessageReactions(conversationId)`: carrega as reações das mensagens visíveis e escuta realtime (INSERT/UPDATE/DELETE), agrupando por mensagem e por emoji.
- `ZappMessageBubble.tsx`: nova faixa de "chips" de reação abaixo do conteúdo (respeitando alinhamento de entrada/saída), com tooltip de quem reagiu e destaque no emoji enviado por nós; botão de reagir na barra de ações do balão abrindo um seletor rápido (👍 ❤️ 😂 😮 😢 🙏 + busca).
- `ZappMessagesList.tsx` / `ZappChatView.tsx`: repassar as reações e o callback de reagir para os balões, com atualização otimista e rollback em erro.
