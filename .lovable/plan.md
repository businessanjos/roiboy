

## Corrigir eventos compartilhados sendo editados como individuais

### Diagnostico

O evento "Mentoria Individual Com Ever - ON-LINE" tem `client_id = NULL` no banco de dados. Isso significa que ele e um **evento compartilhado** vinculado a produtos, e nao um evento individual de um cliente. Esse evento aparece no perfil de **94 clientes** simultaneamente via vinculo de produto.

O problema: na aba Agenda do cliente, eventos compartilhados e individuais aparecem na mesma lista, ambos com botao de editar (icone de lapis). Quando o usuario edita a data de um evento compartilhado pensando que e individual, a alteracao afeta **todos os 94 clientes** que veem esse evento.

### Causa raiz

No componente `ClientAgenda.tsx`, o `fetchEvents` combina eventos individuais (`client_id = clientId`) com eventos compartilhados (`client_id = NULL`, vinculados via `event_products`) na mesma lista. O botao de editar (linha 600-607) permite editar ambos os tipos sem distincao. O `EventEditDialog` atualiza o registro do evento diretamente, afetando todos os clientes vinculados.

### Solucao em 3 partes

#### 1. `src/components/client/ClientAgenda.tsx` - Distinguir visualmente e proteger eventos compartilhados

- Adicionar badge "Individual" (verde) ou "Compartilhado" (azul) em cada evento na tabela
- Para eventos compartilhados (`client_id === null`), **remover o botao de editar** ou substitui-lo por um link "Ver na pagina de Eventos" que direciona para `/events/{id}`
- Manter o botao de editar apenas para eventos individuais (`client_id !== null`)

Logica para determinar tipo:
```text
Se event.client_id != null → Individual (editavel)
Se event.client_id == null → Compartilhado (somente leitura no perfil do cliente)
```

#### 2. `src/components/client/ClientAgenda.tsx` - Secao separada para eventos individuais

- Criar uma secao "Eventos Individuais" dedicada acima da "Agenda de Entregas"
- Essa secao mostra APENAS eventos com `client_id` vinculado ao cliente atual
- Esses eventos sao totalmente editaveis
- A "Agenda de Entregas" continua mostrando eventos compartilhados (vinculados a produtos), mas sem opcao de editar data

#### 3. `src/components/client/ClientAgenda.tsx` - Tabela de eventos individual com edicao

- Filtrar `events` em dois grupos: `individualEvents` (client_id != null) e `sharedEvents` (client_id == null)
- Renderizar tabela dedicada para eventos individuais com acoes completas (editar, excluir)
- Renderizar tabela de eventos compartilhados apenas com acoes de visualizacao e link para pagina do evento

### Arquivos alterados

- **`src/components/client/ClientAgenda.tsx`**: Separar eventos individuais dos compartilhados, adicionar badges visuais, restringir edicao de eventos compartilhados

### Resultado esperado

- Eventos individuais criados via "Novo Evento Individual" ficam isolados por cliente e sao editaveis
- Eventos compartilhados (vinculados a produtos) aparecem como somente leitura no perfil do cliente
- O usuario consegue distinguir visualmente qual evento e individual vs compartilhado
- Editar um evento compartilhado so e possivel na pagina principal de Eventos (`/events`), evitando mudancas acidentais que afetam dezenas de clientes

