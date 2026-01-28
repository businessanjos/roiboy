
# Plano: Corrigir Agendas de Clientes "Vinculadas"

## Diagnóstico do Problema

A investigação revelou a **causa raiz**: o componente `ClientAgenda.tsx` permite criar, editar e excluir eventos na seção "Agenda de Entregas", mas esses eventos são **globais** (vinculados a produtos), não específicos do cliente.

### Dados do Problema

| Evento | Clientes Afetados |
|--------|-------------------|
| Implementação da Clínica Ryka com time | 89 clientes |
| Onboarding | 89 clientes |
| ETERNUM♾️CLUB / PRESENCIAL | 89 clientes |
| Mentoria Individual Com Ever - PRESENCIAL | 89 clientes |

Quando um usuário edita um evento na agenda do "Cliente A", está editando o mesmo registro na tabela `events` que aparece para os outros 88 clientes com o mesmo produto.

### Estrutura Atual

```text
┌────────────┐      ┌──────────────────┐      ┌──────────┐
│  clients   │──┐   │  client_products │   ┌──│ products │
└────────────┘  │   └──────────────────┘   │  └──────────┘
                │            │              │
                └────────────┴──────────────┘
                             │
                    ┌────────┴────────┐
                    │  event_products │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │     events      │ ← EVENTO GLOBAL (compartilhado)
                    └─────────────────┘
```

## Solução

Transformar a seção "Agenda de Entregas" em **somente visualização**. Eventos globais devem ser gerenciados apenas na página `/events`.

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/client/ClientAgenda.tsx` | Remover botões de edição/exclusão/criação de eventos globais |

### Mudanças Detalhadas

#### 1. Remover botão "Novo Evento" (linhas 931-937)

```tsx
// REMOVER este bloco
{clientProductIds.length > 0 && (
  <div className="flex justify-end">
    <Button size="sm" onClick={() => setDialogOpen(true)}>
      <Plus className="h-4 w-4 mr-1" />
      Novo Evento
    </Button>
  </div>
)}
```

#### 2. Remover Dialog de criar/editar evento

- Remover `eventDialogContent` (linhas 549-698)
- Remover `deleteDialogContent` (linhas 701-718)
- Remover todos os states relacionados: `dialogOpen`, `editingItem`, `formData`, `submitting`, etc.
- Remover funções: `handleCreateEvent`, `handleUpdateEvent`, `handleDeleteEvent`, `openEditDialog`, `resetForm`

#### 3. Modificar tabela de eventos - Remover botões de ação (linhas 869-899)

Substituir os botões de Editar/Excluir por apenas o link do evento:

```tsx
// ANTES
<TableCell className="text-right">
  <div className="flex justify-end gap-1">
    {(event.meeting_url || event.material_url) && (...)}
    <Button onClick={() => openEditDialog(event)}>
      <Pencil />
    </Button>
    <Button onClick={() => setEventToDelete(event)}>
      <Trash2 />
    </Button>
  </div>
</TableCell>

// DEPOIS
<TableCell className="text-right">
  <div className="flex justify-end gap-1">
    {(event.meeting_url || event.material_url) && (
      <Button variant="ghost" size="icon" asChild>
        <a href={event.meeting_url || event.material_url} target="_blank" rel="noopener noreferrer">
          <LinkIcon className="h-4 w-4" />
        </a>
      </Button>
    )}
  </div>
</TableCell>
```

#### 4. Ajustar cabeçalho da tabela (linha 774)

Remover a coluna "Ações" quando não houver ações:

```tsx
// ANTES
<TableHead className="text-right">Ações</TableHead>

// DEPOIS - mostrar apenas se tiver links
// (ou remover completamente se não houver mais ações)
```

#### 5. Atualizar texto de "sem eventos" (linhas 1006-1010)

```tsx
// ANTES
<p className="text-xs mt-1">Crie eventos usando o botão acima.</p>

// DEPOIS
<p className="text-xs mt-1">
  Eventos são criados na <a href="/events" className="text-primary underline">página de Eventos</a>.
</p>
```

## O Que Permanece Funcionando

| Funcionalidade | Status |
|----------------|--------|
| Visualizar eventos do produto | ✅ Mantido |
| Marcar participação (checkbox) | ✅ Mantido |
| Convites para Eventos (RSVP) | ✅ Mantido |
| Feedbacks | ✅ Mantido |
| Tarefas do Cliente | ✅ Mantido |

## Resultado Esperado

1. Usuários **não poderão mais** criar/editar/excluir eventos diretamente da agenda do cliente
2. Modificações em um cliente **não afetarão** outros clientes
3. A seção "Agenda de Entregas" mostrará eventos de forma **somente-leitura**
4. Eventos continuarão sendo gerenciados na página `/events` (onde pertencem)
5. O checkbox de participação continua funcionando (isso é por cliente, na tabela `client_event_deliveries`)

## Limpeza de Código

O componente ficará significativamente mais limpo, removendo:
- ~200 linhas de código de formulário/dialog
- 10+ states não utilizados
- 5 funções de manipulação

## Notas para o Time de Operações

Após a correção, para criar ou editar eventos que aparecem na agenda dos clientes:
1. Acessar o menu **Eventos** (`/events`)
2. Criar/editar o evento desejado
3. Vincular aos produtos apropriados
4. O evento aparecerá automaticamente na agenda de todos os clientes com aquele produto
