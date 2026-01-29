

# Plano: Investigar e Corrigir Problemas na Aba Agenda do Cliente

## Situacao Atual

Ao analisar o codigo e a imagem fornecida, identifiquei uma **discrepancia significativa**:

### O Que Encontrei no Codigo Atual

| Elemento | Status no Codigo |
|----------|------------------|
| Coluna "Acoes" com editar/excluir | **NAO EXISTE** |
| Tabela "Proximos Eventos" | Existe, mas **sem botoes de edicao** |
| Funcionalidade | **Somente leitura** (apenas checkbox de participacao) |

### O Que a Imagem Mostra

A imagem mostra claramente uma coluna "Acoes" com icones de lapis (editar) e lixeira (excluir) que **nao existem** no componente `ClientAgenda.tsx` atual.

---

## Memoria do Sistema

Conforme registrado na memoria do projeto:

> "Client agenda 'Agenda de Entregas' section is now **read-only**. Users cannot create, edit, or delete global events from the client profile. All global events are managed exclusively from the /events page."

Isso confirma que a funcionalidade de edicao foi **intencionalmente removida** do perfil do cliente.

---

## Possiveis Cenarios

### Cenario A: A imagem e de uma versao anterior
A funcionalidade de edicao existia anteriormente e foi removida. Os botoes que aparecem na imagem sao de uma versao desatualizada em cache.

### Cenario B: Ha codigo customizado nao sincronizado
Existe uma modificacao local ou fork que adicionou esses botoes.

### Cenario C: O usuario quer que a funcionalidade seja adicionada
O usuario espera poder editar eventos diretamente do perfil do cliente.

---

## Sobre o Problema de Data/Hora

Analisei os dados no banco:

| Evento | No Banco (UTC) | Convertido Brasil (UTC-3) |
|--------|----------------|---------------------------|
| ETERNUM CLUB / PRESENCIAL | 2026-03-15 03:00:00+00 | 15/03/2026 00:00 |
| Implementacao Clinica | 2026-10-22 13:00:00+00 | 22/10/2026 10:00 |

A formatacao atual usa `format(new Date(event.scheduled_at), "dd/MM/yyyy HH:mm")` que e **correta** para timestamps com timezone.

**Possivel causa da data errada**: Se os eventos estao sendo salvos com timezone incorreto (ex: salvando hora local como UTC), a exibicao ficara errada.

---

## Proximos Passos - Preciso de Esclarecimento

Antes de implementar correcoes, preciso entender melhor o cenario:

**Opcao 1: Adicionar funcionalidade de edicao**
Implementar botoes de editar/excluir na tabela de "Proximos Eventos" no perfil do cliente, permitindo modificar eventos diretamente.

**Opcao 2: Corrigir apenas o timezone**
Manter a aba como read-only mas corrigir possiveis problemas de exibicao de data/hora.

**Opcao 3: Redirecionar para pagina de eventos**
Manter read-only mas adicionar um link/botao para editar o evento na pagina principal de eventos (`/events`).

---

## Pergunta ao Usuario

Para que eu possa implementar a solucao correta:

1. **Voce quer poder editar eventos diretamente na aba Agenda do perfil do cliente?** (Isso reverteria a decisao de manter read-only)

2. **Ou a edicao deveria ser feita na pagina de Eventos (`/events`) e a aba Agenda do cliente deve apenas exibir os dados?**

3. **O problema de data esta acontecendo ao criar/editar eventos, ou apenas na exibicao?**

