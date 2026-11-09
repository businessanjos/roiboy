---
name: Pílulas de métrica desmarcam ao clicar de novo
description: Filtros em pílula (ex. métricas do comparativo de crescimento) devem permitir desmarcar ao clicar de novo, com estado vazio discreto
type: preference
---

Ao clicar numa pílula de métrica/filtro já ativa, ela deve desmarcar (toggle off) em vez de continuar travada na seleção.

- Estado sem seleção: resumo mostra `—` e a área do gráfico exibe um aviso discreto "Nenhuma métrica selecionada / Escolha uma métrica acima para ver o comparativo."
- Só uma pílula fica ativa por vez; clicar em outra troca a seleção.
- A coluna correspondente na tabela de edição perde o destaque quando nada está selecionado.
