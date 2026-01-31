
# Plano: Correção do Isolamento de Conversas por Instância no RoyZapp

## Status: ✅ IMPLEMENTADO

## Problema Identificado

A conversa da **Amanda Amaral** (telefone: `+557399164182`) estava aparecendo para o **Everton Pieri** quando ele acessava o setor de Vendas, mesmo que essa conversa pertencesse à instância "Whatsapp Jota" do **Jonathan Marcato**.

### Causa Raiz

O filtro por `integration_id` no hook `useZappData.tsx` **só era aplicado quando `integrationId` era explicitamente passado como parâmetro**.

---

## Solução Implementada

### 1. Auto-seleção de Instância (RoyZapp.tsx)

Adicionado `useEffect` que, quando o setor está selecionado mas `integrationId` é `undefined`:
- Busca a preferência do usuário na tabela `user_instance_preferences`
- Se não houver preferência, usa a primeira integração conectada do setor
- Atualiza a URL com o `integrationId` selecionado

### 2. Persistência na URL (RoyZapp.tsx)

Alterado `useSearchParams` para modo de escrita (`setSearchParams`) permitindo:
- Atualizar a URL quando instância é selecionada
- Manter a instância após refresh da página
- Links compartilhados abrem na instância correta

### 3. Filtro por integration_id (useZappData.tsx)

Implementado filtro em memória em dois locais:
- `fetchAssignmentsOnly()`: filtro aplicado após busca do banco
- `fetchData()`: mesmo filtro aplicado

**Lógica de Filtro:**
- Grupos (`is_group=true`): Visíveis cross-instância (comportamento intencional)
- Contatos individuais: Filtrados por `integration_id`
- Conversas legacy (sem `integration_id`): Mantidas visíveis

### 4. Warnings de Segurança

Adicionados `console.warn()` quando:
- Setor selecionado mas sem `integrationId` especificado
- Possível vazamento de conversas cross-instância

---

## Arquivos Modificados

1. `src/pages/RoyZapp.tsx` - Auto-seleção e persistência na URL
2. `src/hooks/useZappData.tsx` - Filtro por integration_id

---

## Impacto

- **Usuários normais**: Verão apenas conversas da sua instância preferida
- **Admins**: Também respeitarão o filtro por instância (podem trocar manualmente)
- **Grupos**: Continuarão visíveis cross-instância (comportamento intencional)
- **Conversas legacy**: Continuarão visíveis para o setor original
