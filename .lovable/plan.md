

## Exibir apenas eventos "Em Aberto" por padrao na aba de Eventos

### Problema

Atualmente, o filtro de status na pagina de Eventos inicia com o valor `"all"` (Todos os status), fazendo com que eventos concluidos e cancelados aparecam na listagem por padrao. No setor de Operacoes, isso polui a visualizacao com eventos que ja foram finalizados.

### Solucao

Alterar o valor inicial do estado `filterStatus` de `"all"` para `"open"` no arquivo `src/pages/Events.tsx`. Isso fara com que, por padrao, somente eventos em aberto sejam exibidos. O usuario ainda podera selecionar "Todos os status", "Concluido" ou "Cancelado" no filtro para visualizar os demais.

### Detalhes tecnicos

**Arquivo: `src/pages/Events.tsx` (linha 154)**

Alterar:
```typescript
const [filterStatus, setFilterStatus] = useState<string>("all");
```
Para:
```typescript
const [filterStatus, setFilterStatus] = useState<string>("open");
```

A logica de filtragem ja existe corretamente nas linhas 596-601 e nao precisa de nenhuma alteracao. Somente o valor padrao muda.

