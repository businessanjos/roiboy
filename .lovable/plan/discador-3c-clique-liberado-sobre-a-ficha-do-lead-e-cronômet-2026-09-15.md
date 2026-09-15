# Discador 3C: clique liberado sobre a ficha do lead e cronômetro visível

## O que está acontecendo

**1. Não dá para clicar na qualificação.** Quando a ficha do lead/negócio está aberta, ela é uma janela "modal": enquanto ela está na tela, o sistema bloqueia cliques em tudo que está fora dela e puxa o foco de volta o tempo todo. O discador da 3C fica fora dessa janela, então os cliques dentro dele (inclusive o campo de qualificação pós ligação) não chegam ao destino.

**2. O cronômetro não aparece enquanto liga.** Dois motivos:
- O cartão flutuante só aparece quando o painel está fechado; ao discar, o painel abre sozinho e o cartão nunca chega a aparecer.
- Assim que a consulta de estado do agente responde "offline" ou "intervalo" (o que é comum nos primeiros segundos da discagem), o contador de tentativa é zerado e o cartão some.

## O que vai mudar

1. **Clique livre no discador com a ficha aberta.** Enquanto o painel da 3C estiver aberto, a ficha do lead/negócio deixa de bloquear o resto da tela: dá para clicar normalmente na qualificação, digitar e rolar dentro do discador, e a ficha continua aberta atrás.
2. **Cronômetro sempre visível durante a tentativa.** O tempo passa a aparecer desde o momento em que a ligação é disparada, tanto no cabeçalho do painel (hoje só mostra quando atende) quanto no cartão flutuante.
3. **O cartão flutuante não some mais sozinho.** Ele deixa de ser apagado por uma leitura momentânea de "offline"/"intervalo"; só desaparece quando a ligação encerra de fato ou depois de 2 minutos sem atender.
4. **Tempo também com o painel aberto.** Com o painel aberto e uma chamada em andamento, o cartão pequeno continua visível num canto, para o vendedor ver o tempo mesmo olhando outra parte da tela.

## Detalhes técnicos

`src/components/threecplus/ThreeCPlusPanel.tsx`
- Expor o estado aberto do discador num contexto/estado global leve (ex.: `useThreeCPlusOpen` com store simples em módulo + `useSyncExternalStore`), para que as fichas saibam quando desligar o modo modal.
- Cronômetro: no cabeçalho, trocar a condição `inCall` por `activeCall`, rotulando "Chamando"/"Em chamada".
- Remover a limpeza de `dialingSince` quando `status` vira `offline`/`pause` (linha do efeito do cronômetro); manter a limpeza apenas na transição de `on_call` para outro estado e no timeout de 120s.
- Cartão flutuante: renderizar quando `activeCall && !launcherHidden`, independentemente de `isOpen`; quando `isOpen`, esconder o botão "Abrir" e mostrar só contato + tempo.
- Garantir `pointer-events-auto` explícito no `aside`, no cartão e na abinha (o modal do Radix aplica `pointer-events: none` no `body`).

`src/components/sales/DealDetailSheet.tsx` e `src/components/leads/LeadDetailSheet.tsx`
- `<Sheet open={open} onOpenChange={onOpenChange} modal={!dialerOpen}>` usando o novo hook, para desativar o travamento de foco/cliques enquanto o discador está aberto.

Sem mudanças em regras de negócio, registro em `threecplus_call_logs` ou integração com a 3C.
