
## Corrigir navegacao do nome do contato para sempre priorizar o Lead

### Causa raiz

O problema nao esta no codigo de navegacao (que ja prioriza `lead_id`), mas sim nos **dados**: quando um negocio e marcado como "Ganho", o sistema atualiza o `client_id` do deal mas o `lead_id` permanece `null` (provavelmente porque o deal foi criado antes dessa associacao existir, ou nunca foi preenchido). Exemplo real: o deal "[CARTEIRA - RM] Magda Paula Morais Cardoso" tem `lead_id: null` e `client_id` preenchido, mesmo existindo um lead com o mesmo nome.

### Solucao

Duas mudancas complementares:

**1. `src/components/sales/DealDetailSheet.tsx` — Busca inteligente do Lead**

Quando `deal.lead_id` for `null` mas `deal.client_id` existir, buscar um lead correspondente por:
- Primeiro: verificar se existe um lead vinculado ao mesmo `client_id` (via outros deals que tenham `lead_id`)
- Segundo: buscar por nome exato (`full_name`) na tabela `leads`

Armazenar o `lead_id` encontrado em um estado local (`resolvedLeadId`) e usar na logica de navegacao.

A logica de clique ficara:
1. Se `deal.lead_id` existe → navegar para `/leads?lead={lead_id}`
2. Se `resolvedLeadId` foi encontrado → navegar para `/leads?lead={resolvedLeadId}`
3. Se `deal.client_id` existe → navegar para `/clients/{client_id}` (fallback final)
4. Senao → texto sem link

**2. `src/pages/SalesPipeline.tsx` — Preservar `lead_id` ao marcar como Ganho**

No `handleMarkAsWon`, ao fazer o update do deal com `client_id` (linha 402), incluir tambem o `lead_id` caso o deal ja tenha um. Isso previne que futuros deals percam essa associacao. Mudar:
```
.update({ client_id: clientId })
```
para manter o `lead_id` existente (nao altera-lo).

Na verdade, o update atual ja nao limpa o `lead_id` — o problema e que deals antigos nunca tiveram `lead_id` preenchido. Portanto, foco principal e no item 1.

### Secao tecnica

| Arquivo | Mudanca |
|---------|---------|
| `DealDetailSheet.tsx` | Adicionar `useEffect` que busca lead correspondente quando `lead_id` e null. Usar estado `resolvedLeadId`. Atualizar logica de navegacao do nome do contato para usar `resolvedLeadId` como segunda opcao |

**Implementacao do useEffect:**
- Quando o deal abre e `deal.lead_id` e null mas `deal.client?.full_name` existe
- Buscar na tabela `leads` por `full_name` igual ao nome do contato
- Se encontrar, guardar o ID no `resolvedLeadId`
- Usar esse ID na navegacao

### Comportamento esperado

- Deals com `lead_id` preenchido: continua funcionando como antes
- Deals com `lead_id` null mas que tem um lead com mesmo nome: navega para o lead
- Deals sem lead correspondente: fallback para pagina do cliente
