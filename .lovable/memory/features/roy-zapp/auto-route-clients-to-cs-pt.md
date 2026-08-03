---
name: Roteamento automático de clientes para o CS
description: Trigger que move conversas de clientes convertidos com contexto de suporte da fila do Comercial para o Customer Success
type: feature
---

Trigger `trg_auto_route_client_conversation_to_cs` em `zapp_messages` (AFTER INSERT) chama `public.auto_route_client_conversation_to_cs()`.

Regras:
- Só mensagens inbound (`client_to_team`) com texto (usa `content` ou `transcription`).
- Só conversas com `client_id` preenchido (cliente já convertido).
- Contexto de suporte detectado por regex (não consigo, acesso, senha, plataforma, aula, mentoria, encontro presencial, boleto, nota fiscal, suporte, atendimento, ajuda, etc).
- Não move se houver deal aberto (`status` diferente de won/lost) vinculado à conversa.
- Move o assignment aberto do departamento `vendas` para o departamento `operacoes` (Customer Success), atribuindo ao consultor responsável do cliente quando ele tiver `zapp_agent` ativo; senão entra como `triage`.
- Se já houver ticket aberto no CS, apenas fecha o do Comercial com `close_notes` automático.
- Toda movimentação é registrada em `zapp_transfers` com o motivo "Roteamento automático: cliente ativo com contexto de suporte/CS".
