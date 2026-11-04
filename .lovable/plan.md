# Etiquetas nas Sequências do Playbook e no RoyZapp

## 1. Novo passo "Adicionar ação" na sequência
- Ao lado de "Adicionar mensagem" e "Nova mensagem", um botão **"Adicionar ação"**.
- A ação, por enquanto, é **"Etiquetar contato"**: escolher uma etiqueta que já existe (lista com cor) ou **criar uma nova** ali mesmo (nome + cor), que já fica salva nas etiquetas do RoyZapp.
- A ação ocupa uma linha da sequência como as mensagens (pode subir/descer, excluir e ter o "aguardar X s").
- Na prévia do celular aparece como um aviso discreto no meio da conversa ("Etiqueta 'Convite treinamento' aplicada"), sem virar mensagem.
- No envio em segundo plano, quando chega a vez da ação, a etiqueta é colocada na conversa automaticamente (sem duplicar se já tiver). Nada é enviado ao contato.

## 2. Etiquetas visíveis no RoyZapp
- Hoje a lista de conversas não mostra as etiquetas (há 203 etiquetagens salvas em 11 etiquetas).
- Mostrar em cada conversa, logo abaixo/ao lado do nome, **selos arredondados com a cor e o nome da etiqueta** (até 2 visíveis + "+N"), no mesmo estilo do selo de etapa do funil.
- No topo da conversa aberta, os mesmos selos ao lado do nome do contato.
- Isso substitui a regra antiga que escondia etiquetas manuais da lista (memória será atualizada).

## Detalhes técnicos
- Sequências: novo `content_type = 'tag'` nos itens da sequência e em `zapp_sequence_run_steps`, com `tag_id` (coluna nova nullable). Migração só adiciona coluna/valor permitido.
- `zapp-sequence-dispatcher`: passo `tag` faz upsert em `zapp_conversation_tags` (assignment da conversa, `onConflict assignment_id,tag_id`) e marca o passo como enviado sem chamar o WhatsApp; não conta como mensagem manual nem cancela a sequência.
- Criação de etiqueta reaproveita o insert existente em `zapp_tags` (RLS por conta preservada).
- UI: `PlaybookSequencesDialog.tsx`, `PlaybookSequencePreview.tsx`, `ZappConversationItem.tsx` e cabeçalho do chat; cores via estilo inline da cor salva (com fallback), como já é feito para etapas.
