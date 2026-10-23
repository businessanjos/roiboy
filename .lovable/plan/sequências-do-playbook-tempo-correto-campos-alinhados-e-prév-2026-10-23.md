# Sequências do Playbook: tempo correto, campos alinhados e prévia de celular

## O que encontrei no teste de hoje (11:21)
Sequência de 3 mensagens: os horários foram calculados todos no momento do clique (msg 2 em +1s, msg 3 em +11s). Como a 1ª mensagem levou ~4s para o WhatsApp confirmar, a 2ª já estava "atrasada" e saiu só 3s depois, e a 3ª saiu 4s depois da 2ª. Ou seja, a espera é contada do clique, não do envio da mensagem anterior. Além disso, o campo "esperar" fica na mensagem errada (é a espera *depois* dela), por isso a última não tem campo.

## O que muda
1. **Regra de tempo nova (mais intuitiva)**
   - Mensagem 1: sempre **Instantânea** (sai no clique). No lugar do campo aparece um selo "Instantâneo" com a mesma largura do campo, para tudo ficar alinhado.
   - Mensagem 2 em diante: campo "aguardar __ s" = tempo de espera **antes** desta mensagem, contado a partir do momento em que a anterior foi realmente enviada.
   - A última mensagem passa a ter o seu campo de segundos.
   - Ao reordenar (subir/descer), a mensagem que vira a 1ª fica instantânea automaticamente; os números não "pulam" nem desalinham.
   - Sequências já salvas são convertidas para a regra nova preservando os tempos entre as mensagens.
2. **Envio respeitando os segundos**: o envio em segundo plano passa a agendar cada mensagem somente após confirmar a anterior (envio anterior + espera configurada).
3. **Modal maior**: diálogo mais largo no computador (editor + prévia lado a lado com folga) e ocupando a tela no celular, com linhas de mensagem sem aperto (número, seletor, segundos e ações em linha; quebra organizada em telas pequenas).
4. **Prévia como celular**: moldura de smartphone com barra de status, cabeçalho verde do WhatsApp (foto, nome do contato, "online"), fundo de papel de parede do WhatsApp, balões verdes de saída com horário e tiques, separadores "aguarda 10s" entre balões e barra de digitação no rodapé.

## Detalhes técnicos
- `PlaybookSequencesDialog.tsx`: `delay_seconds` passa a significar "espera antes"; índice 0 mostra badge fixo `w-[7.5rem]` igual ao bloco do input; `moveStep`/remover zeram o delay do novo primeiro. `DialogContent` `max-w-5xl`, `h-[100dvh] sm:h-auto` no mobile; grade `lg:grid-cols-[minmax(0,1fr)_340px]`.
- `usePlaybookSequences.ts`: `computeSequenceSchedule` usa delay do próprio passo (passo 0 = 0); atualizar testes.
- Migração de dados: deslocar `delay_seconds` uma posição em `playbook_sequence_steps` (passo i recebe o delay antigo de i-1; passo 0 = 0). Sem mudança de permissões.
- `zapp-sequence-dispatcher`: após enviar o passo, atualizar `scheduled_at` do próximo pendente para `now() + delay_seconds` (guardar `delay_seconds` em `zapp_sequence_run_steps`, coluna nova com default 0). Redeploy da função.
- `PlaybookSequencePreview.tsx`: redesenho em moldura de celular usando tokens do design system (adicionar tokens `--whatsapp-*` no CSS).
- Testes: agenda (1ª instantânea, espera antes de cada uma), reordenação mantém 1ª instantânea, prévia mostra esperas.
- Validação: Playwright em 320/393/1440 sem enviar mensagens reais.
