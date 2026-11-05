# Calls Comerciais: reuniões a fazer e feitas, com a Clínica Ryka separada

## O que entendi
Na aba de Calls Comerciais do painel (leaderboard), você quer ver por vendedor:
- **A fazer:** reuniões marcadas pela atividade "Call Comercial Agendada" dentro do negócio, que ainda não foram concluídas.
- **Feitas:** reuniões com a atividade "Call Comercial Concluída" dentro do negócio.

Regras:
- **Sem duplicar:** se o mesmo negócio tem duas atividades iguais, conta uma vez só. Essa regra continua igual no cartão da Clínica Ryka.
- **Tirar a Clínica Ryka do cartão principal:** o cartão "Calls Comerciais" mostra só o comercial, sem nada da Clínica Ryka.
- **Um cartão só para a Clínica Ryka (CR)**, na mesma aba, com a mesma conta de a fazer e feitas.

## Como está hoje
Esse painel já tem os dois cartões: "Calls Comerciais" e "Calls Comerciais · Clínica Ryka (CR)". A conta já é feita pelas atividades dentro do negócio e não duplica por negócio. Ainda não confirmei se algo da Clínica Ryka continua aparecendo no cartão principal.

## O que vou fazer
1. Abrir o painel e comparar os números de cada cartão com as atividades cadastradas nos negócios, vendedor por vendedor.
2. Se algo da Clínica Ryka estiver aparecendo no cartão principal (por exemplo, atividade sem negócio ou funil com nome diferente), tirar de lá e mandar para o cartão da CR.
3. Deixar os nomes claros nos dois cartões: **"A fazer"** e **"Feitas"**.
4. Mostrar ao lado do título qual período está sendo contado.
5. Te mandar o resultado com os números de cada vendedor para você conferir.

## Detalhes técnicos
- Visuais `call_commercial` no painel: `dff91c16` (sem escopo, padrão `exclude_cr`) e `1378540e` (`only_cr`). Regra em `fetchTasksCallCommercialData` (`src/hooks/useVisualData.ts`).
- Ponto a verificar: tarefas sem `deal_id` hoje são descartadas pelo `deals!inner` nos escopos `exclude_cr`/`only_cr`. Também vou checar se a detecção do funil CR pelo nome cobre todos os funis da Clínica Ryka.
- A mudança fica só na tela. Permissões e dados não mudam.
