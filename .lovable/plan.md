# Sequências salvas no Playbook do RoyZapp

## Situação atual
O Playbook do chat já permite marcar vários itens e enviar em fila, com um único intervalo para todos. Mas essa fila **não fica salva**: cada vendedor precisa montar de novo toda vez. O AnjosZapp tem "envio múltiplo (script)" salvo com nome, que qualquer um dispara com um clique.

## O que vamos criar

1. **Criar sequência** (dentro do Playbook)
   - Nome da sequência (ex.: "Follow Preocupado").
   - Lista de passos: em cada linha, escolher uma mensagem já cadastrada no Playbook (texto, áudio, imagem, vídeo, documento etc.) e o tempo de espera antes do próximo envio (1 a 300 segundos).
   - Adicionar, remover e reordenar passos.
   - Visibilidade igual aos itens: "Só eu" ou "Todo o setor".

2. **Lista de sequências**
   - Nova seção "Sequências" no Playbook, com busca, editar, duplicar e excluir (só quem criou, ou gestor).

3. **Disparar no chat**
   - No Playbook aberto dentro da conversa, a aba "Sequências" mostra as salvas; um clique em "Enviar" dispara todos os passos na ordem, com os tempos definidos.
   - Aviso de progresso ("Enviando 2/5... próximo em 8s") e botão **Cancelar** para parar o restante.
   - Variáveis como {primeiro_nome} continuam sendo trocadas em cada mensagem.

4. **Segurança contra bloqueio do WhatsApp**
   - Intervalo mínimo de 1s, máximo de 15 passos por sequência e uma sequência por vez na mesma conversa.

## Fora do escopo
- Agendamento para outro dia (isso já é a Régua de Relacionamento).
- Disparo para vários contatos ao mesmo tempo (proibido pela regra anti-ban).

## Detalhes técnicos
- Novas tabelas `playbook_sequences` (nome, visibilidade, setor, criador, conta) e `playbook_sequence_steps` (sequence_id, playbook_item_id, position, delay_seconds), com GRANTs e RLS no mesmo padrão de `playbook_items` (conta + visibilidade pessoal/setor).
- Hook `usePlaybookSequences` (CRUD via react-query).
- UI: `PlaybookSequenceForm` e aba "Sequências" em `PlaybookDialog.tsx` e `ZappPlaybookList.tsx`.
- Envio: estender `handleMultiSend` em `RoyZapp.tsx` para aceitar delay por passo e cancelamento (ref de abort), reutilizando `sendSinglePlaybookItem`.
