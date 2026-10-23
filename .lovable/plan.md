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

3. **Disparar no chat, rodando em segundo plano**
   - No Playbook aberto dentro da conversa, a aba "Sequências" mostra as salvas; um clique em "Enviar" agenda todos os passos.
   - O envio acontece pelo próprio ROY, não pela tela: você pode ir para outra conversa, outra página ou até fechar o navegador que a sequência continua respeitando os tempos.
   - Na conversa aparece uma faixa discreta "Sequência X em andamento (2/5)" com botão **Cancelar**.
   - **Interrupção automática:** se você (ou outra pessoa da equipe) mandar uma mensagem manual nessa mesma conversa, os passos restantes são cancelados na hora. Resposta do cliente não interrompe.
   - Variáveis como {primeiro_nome} continuam sendo trocadas em cada mensagem.

4. **Segurança contra bloqueio do WhatsApp**
   - Intervalo mínimo de 1s, máximo de 15 passos por sequência e uma sequência ativa por vez na mesma conversa.

## Fora do escopo
- Agendamento para outro dia (isso já é a Régua de Relacionamento).
- Disparo para vários contatos ao mesmo tempo (proibido pela regra anti-ban).

## Detalhes técnicos
- Tabelas de modelo: `playbook_sequences` (nome, visibilidade, setor, criador, conta) e `playbook_sequence_steps` (sequence_id, playbook_item_id, position, delay_seconds), com GRANTs e RLS no padrão de `playbook_items`.
- Tabelas de execução: `zapp_sequence_runs` (conversa, sequência, quem disparou, status running/done/cancelled/failed, motivo) e `zapp_sequence_run_steps` (snapshot do conteúdo já com variáveis trocadas, scheduled_at, status, erro). RLS por conta + acesso ao setor.
- Nova função de servidor `zapp-sequence-dispatcher`: acionada no momento do disparo e reagendada para cada próximo passo (sem varredura permanente); usa claim atômico para não enviar em dobro e envia pelo mesmo caminho UAZAPI da Régua (`zapp-ruler-dispatcher`), gravando a mensagem com `sender_user_id` de quem disparou.
- Interrupção: trigger em `zapp_messages` (outbound, manual, não originada pela sequência) cancela runs ativas daquela conversa; mensagens da sequência são marcadas para não acionar o trigger.
- UI: hook `usePlaybookSequences`, `PlaybookSequenceForm`, aba "Sequências" em `PlaybookDialog.tsx`/`ZappPlaybookList.tsx` e faixa de progresso em realtime no chat. O envio em fila atual (sem salvar) continua existindo.
