
# Plano: Corrigir Automação de Onboarding e Visibilidade de Tarefas

## Análise do Problema

### Problema 1: Criação de evento automático
Atualmente, quando um negócio é marcado como "Ganhado", a função `createClientOnboardingItems` cria:
- 1 evento "Onboarding" (categoria: operation)
- 2 tarefas vinculadas ao cliente

**Você solicitou**: Remover a criação automática do evento, mantendo apenas as tarefas.

### Problema 2: Tarefas não aparecem na aba "Agenda" do cliente
As tarefas para Ariella Duarte foram criadas corretamente no banco:
- ✅ "Implementação da Clínica Ryka" (criada em 06/02/2026)
- ✅ "Apresentação do Plano de Ação" (criada em 06/02/2026)

**Por que não aparecem?** O componente `ClientAgenda.tsx` possui um "early return" na linha 378 que interrompe a renderização se o cliente não tiver produtos vinculados:

```typescript
// Linha 378-386
if (clientProductIds.length === 0) {
  return (
    <div>Este cliente não possui produtos vinculados...</div>
  );
}
```

O componente `ClientTasks` é renderizado na linha 756, **após** esse return, então nunca é exibido para clientes sem produtos.

---

## Solução Proposta

### 1. Remover criação automática de eventos
Modificar o arquivo `src/utils/clientOnboardingAutomation.ts`:
- Remover STEP 1 (criação do evento)
- Remover STEP 2 (vinculação do participante)
- Manter apenas STEP 3-4 (busca de activity types e criação de tarefas)
- Renomear função para `createClientOnboardingTasks` para refletir o comportamento

### 2. Corrigir visibilidade das tarefas na aba Agenda
Modificar o arquivo `src/components/client/ClientAgenda.tsx`:
- Mover a seção `ClientTasks` para **antes** do early return
- Garantir que tarefas sempre apareçam, independente de produtos vinculados
- Manter a lógica de eventos/entregas condicionada a produtos

---

## Alterações Técnicas

### Arquivo 1: `src/utils/clientOnboardingAutomation.ts`

**Antes:**
```typescript
export async function createClientOnboardingItems({...}) {
  // STEP 1: Create event
  // STEP 2: Link participant
  // STEP 3: Fetch activity types
  // STEP 4: Create tasks
}
```

**Depois:**
```typescript
export async function createClientOnboardingTasks({...}) {
  // STEP 1: Fetch activity types  
  // STEP 2: Create tasks only
}
```

### Arquivo 2: `src/components/client/ClientAgenda.tsx`

**Antes (estrutura simplificada):**
```typescript
if (clientProductIds.length === 0) {
  return <div>Sem produtos...</div>;
}

// ... renderização de eventos ...

<ClientTasks clientId={clientId} />  // ← Nunca alcançado sem produtos!
```

**Depois:**
```typescript
// Seção de tarefas SEMPRE visível
<ClientTasks clientId={clientId} />

{clientProductIds.length === 0 ? (
  <div className="border-t pt-6 mt-6">
    <div>Sem produtos para eventos...</div>
  </div>
) : (
  // ... renderização de eventos ...
)}
```

### Arquivo 3: `src/pages/SalesPipeline.tsx`
- Atualizar import para usar novo nome da função

---

## Resultado Esperado

1. Ao converter um lead em cliente:
   - ❌ Não cria mais evento de "Onboarding"
   - ✅ Continua criando as 2 tarefas de onboarding

2. Na aba "Agenda" do perfil do cliente:
   - ✅ Tarefas sempre visíveis, mesmo sem produtos
   - ✅ Seção de eventos aparece apenas se houver produtos vinculados

3. Para Ariella Duarte (recarregue a página após implementação):
   - ✅ As 2 tarefas criadas aparecerão na aba Agenda
