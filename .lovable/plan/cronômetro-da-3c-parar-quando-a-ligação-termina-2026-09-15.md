# Cronômetro da 3C: parar quando a ligação termina

## O que acontece hoje

O contador do cartão flutuante só zera quando o estado geral do agente deixa de ser "em chamada". Na 3C, depois que a ligação cai o agente continua nesse estado enquanto a tela de qualificação está aberta — então o tempo segue correndo como se a pessoa ainda estivesse falando. Na tentativa que não é atendida, o tempo também continua por até 2 minutos.

## O que vai mudar

1. **O tempo para assim que a ligação encerra.** O painel passa a olhar se existe uma chamada ativa de fato, não só o estado do agente. Sem chamada ativa, o cronômetro para na hora.
2. **Qualificação = ocioso.** Enquanto o vendedor preenche a qualificação, o cartão mostra "Ocioso" (sem contador correndo) em vez de continuar cronometrando.
3. **Sair/desligar na 3C encerra o cartão.** Ao sair ou desligar no discador, o cartão flutuante deixa de mostrar tempo e volta ao estado normal.
4. **Checagem mais rápida no fim da chamada.** Enquanto houver chamada ativa, o estado continua sendo consultado a cada 5 segundos, para o corte ser quase imediato.

## Detalhes técnicos

`src/components/threecplus/ThreeCPlusPanel.tsx`

- Guardar `has_active_call` do runtime num estado (`hasActiveCall`), hoje o campo existe em `AgentRuntime` mas é ignorado; `refreshStatus` passa a setá-lo (false quando a consulta falha ou `success` é falso).
- `inCall` deixa de ser `status === "on_call"` e passa a ser `status === "on_call" && hasActiveCall !== false`. Assim, quando a 3C mantém o agente em ACS/qualificação sem chamada ativa, o painel trata como encerrado.
- Efeito do cronômetro: `callStartedAt.current` é limpo e `setElapsed(0)` quando `inCall` vira falso; o intervalo de 1s só roda enquanto `inCall` ou `dialing`.
- Limpar `dialingSince` quando `hasActiveCall === false` e `status !== "on_call"` (tentativa encerrada/desligada), além do timeout de 120s já existente.
- Manter o polling de 5s enquanto `inCall`; usar `inCall` (não `status`) nessa decisão.

Sem alteração em `threecplus_call_logs`, no registro de atividades ou no fallback do discador.
