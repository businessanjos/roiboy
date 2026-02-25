

## Adicionar botao de editar nos eventos compartilhados da Agenda do cliente

### Problema

Atualmente, na aba "Agenda" do perfil do cliente, apenas eventos **individuais** possuem o botao de editar (icone de lapis). Eventos **compartilhados** mostram apenas um link "Ver" que redireciona para a pagina `/events`, sem permitir edicao direta.

### Solucao

**Arquivo:** `src/components/client/ClientAgenda.tsx`

Na funcao `renderEventTable`, alterar a coluna de acoes (linhas 613-629) para exibir o botao de editar tambem nos eventos compartilhados. O botao "Ver" sera mantido ao lado, pois ele redireciona para a pagina de detalhes do evento.

### Mudanca

Substituir a logica condicional que mostra **ou** o botao de editar (individual) **ou** o link "Ver" (compartilhado) por uma logica que mostra **ambos** para todos os eventos:

1. Botao de editar (Pencil) -- sempre visivel, chama `handleEditEvent(event)` que ja existe e funciona
2. Link "Ver" -- visivel apenas para eventos compartilhados, para acessar a pagina completa do evento

A funcao `handleEditEvent` ja converte o evento para o formato `EventData` e abre o `EventEditDialog`, que ja esta importado e renderizado no componente. Nenhuma alteracao adicional e necessaria.

### Detalhes tecnicos

No bloco de acoes (linhas 613-629), substituir por:

```tsx
<Button 
  variant="ghost" 
  size="icon"
  onClick={() => handleEditEvent(event)}
  title="Editar evento"
>
  <Pencil className="h-4 w-4" />
</Button>
{event.client_id === null && (
  <Button variant="ghost" size="sm" asChild>
    <Link to={`/events`} title="Ver na página de Eventos">
      <LinkIcon className="h-3 w-3 mr-1" />
      Ver
    </Link>
  </Button>
)}
```

Isso garante que o botao de editar apareca para **todos** os eventos (individuais e compartilhados), e o link "Ver" continua disponivel apenas para compartilhados.

