

## Correcao: Eventos compartilhados entre clientes sendo sobrescritos

### Diagnostico

O problema NAO e um bug de codigo, mas sim uma limitacao arquitetural. Eis o que acontece:

1. Eventos sao vinculados a **produtos** (tabela `event_products`), nao a clientes individuais
2. Todos os clientes que possuem o mesmo produto veem os **mesmos eventos** na aba Agenda
3. Quando voce "cria" ou "edita" um evento (ex: "Mentoria Individual Com Ever"), esta alterando um **unico registro** na tabela `events`
4. Como todos os clientes com aquele produto compartilham o mesmo registro, a alteracao aparece para todos

Exemplo concreto: o evento "Mentoria Individual Com Ever - ON-LINE" (ID: `a8406aaf`) esta vinculado ao produto `b8c50eca`. Todo cliente que possui esse produto ve esse mesmo evento. Se voce edita esse evento a partir da agenda do Cliente B, o Cliente A tambem ve a mudanca, porque e o mesmo registro.

### Solucao proposta

Adicionar suporte a **eventos individuais por cliente**, separados dos eventos compartilhados por produto.

#### 1. Migracao de banco: adicionar `client_id` na tabela `events`

```text
ALTER TABLE public.events ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX idx_events_client_id ON public.events(client_id);
```

Eventos com `client_id` preenchido sao individuais (aparecem apenas na agenda daquele cliente). Eventos sem `client_id` continuam funcionando como hoje (compartilhados via produtos).

#### 2. Atualizar `ClientAgenda.tsx` para buscar eventos individuais do cliente

Alem dos eventos via produtos/deliveries/attendance, tambem buscar eventos onde `client_id` corresponde ao cliente atual (ou linked clients):

```text
// Adicionar ao fetchEvents():
const { data: individualEvents } = await supabase
  .from("events")
  .select("*, event_products(product_id)")
  .in("client_id", linkedClientIds);

// Combinar com allEventIds existentes
```

#### 3. Atualizar `EventEditDialog.tsx` para preservar o `client_id`

Ao salvar um evento individual, garantir que `client_id` e mantido no update.

#### 4. Adicionar botao "Novo Evento Individual" na ClientAgenda

Permitir criar eventos diretamente na agenda do cliente, pre-preenchendo o `client_id`. Isso criara um evento exclusivo daquele cliente, separado dos eventos compartilhados por produto.

#### 5. Atualizar pagina `/events` para exibir contexto

Na listagem geral de eventos, mostrar se o evento e individual (com nome do cliente) ou compartilhado (via produto).

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| Migracao SQL | Adicionar coluna `client_id` + indice |
| `src/components/client/ClientAgenda.tsx` | Buscar eventos individuais + botao "Novo Evento" |
| `src/components/events/EventEditDialog.tsx` | Suportar criacao (alem de edicao) com `client_id` |
| `src/pages/Events.tsx` | Mostrar badge de cliente individual na listagem |

### Resultado esperado

- Eventos de mentoria individual ficam exclusivos de cada cliente
- Eventos compartilhados por produto continuam funcionando normalmente
- O usuario pode criar eventos individuais diretamente na agenda do cliente
- Editar um evento individual nao afeta outros clientes

