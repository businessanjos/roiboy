# Marcação "Coquetel" nos participantes do evento

## O que muda

Na aba **Participantes** de um evento:

1. No menu **Ações** de cada participante, entra a opção **Coquetel** — clicar marca a pessoa como convidada do coquetel; clicar de novo desmarca ("Remover do coquetel").
2. Quem estiver marcado ganha uma etiqueta discreta "Coquetel" ao lado do nome, para dar para ver na lista sem abrir o menu.
3. No painel de números do topo (Total, Confirmados, Presentes...), entra um cartão **Coquetel** com a quantidade de pessoas marcadas. Clicar no cartão filtra a lista só para elas.

A marcação é independente da confirmação de presença: uma pessoa pode estar Pendente, Confirmada ou Presente e ainda assim estar no coquetel.

## Detalhes técnicos

- Armazenamento: campo `custom_data` (jsonb) de `event_participants`, chave `coquetel: true`. Sem migração de banco, sem mudança de RLS.
- `src/components/events/EventParticipantsTab.tsx`:
  - novo `toggleCoquetel(p)` fazendo `update` em `event_participants` com `custom_data` mesclado, com toast e refetch como nos demais itens de Ações;
  - `DropdownMenuItem` "Coquetel" / "Remover do coquetel" (ícone `Martini` ou `Wine` do lucide) acima de "Remover";
  - `stats.coquetel` contando `p.custom_data?.coquetel === true`;
  - cartão extra em `filterCards` com chave `"coquetel"`, ampliando o tipo da chave para `EventRsvpStatus | "all" | "coquetel"`;
  - `filteredParticipants` trata a chave `coquetel` como filtro pela marcação, não pelo `rsvp_status`;
  - tipo `Participant` ganha `custom_data: Record<string, any> | null` e o `select` passa a trazer a coluna.
