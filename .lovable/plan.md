
# Plano: Adicionar Campo "Mensagem" Obrigatório ao Momento CX

## Objetivo
Adicionar um novo campo chamado **"Mensagem"** ao formulário "Novo Momento CX" que será a mensagem enviada ao cliente nas campanhas. Este campo será **obrigatório** e ficará separado do campo "Descrição" (que permanece opcional para uso interno).

## Alterações Necessárias

### 1. Banco de Dados
Adicionar nova coluna `message` na tabela `client_life_events`:

```sql
ALTER TABLE client_life_events 
ADD COLUMN message TEXT;
```

A coluna será nullable para manter compatibilidade com registros existentes, mas o formulário exigirá preenchimento obrigatório para novos registros.

### 2. Componente ClientLifeEvents.tsx

**Novo estado do formulário:**
- Adicionar `formMessage` para o novo campo

**Posicionamento do campo no formulário:**
- Após "Título" e "Data"
- Antes de "Descrição (opcional)"

**Campo com:**
- Label: "Mensagem *"
- Placeholder: "Mensagem que será enviada ao cliente..."
- Textarea com 3 linhas
- Validação obrigatória no `handleSave`

**Variáveis disponíveis (dica visual):**
Texto de ajuda abaixo do campo mostrando: `{nome}, {primeiro_nome}, {momento_titulo}`

### 3. Edge Function send-cx-moment-campaign

Atualizar o payload para incluir a mensagem do momento:
- Adicionar `event_message` ao interface `Recipient`
- Adicionar nova variável `{momento_mensagem}` que pode ser usada no template

---

## Detalhes Técnicos

### Interface LifeEvent atualizada:
```typescript
interface LifeEvent {
  // ... campos existentes
  message: string | null;  // Nova propriedade
}
```

### Validação no handleSave:
```typescript
if (!formMessage.trim()) {
  toast.error("Mensagem é obrigatória");
  return;
}
```

### Ordem dos campos no formulário:
1. Tipo de Momento
2. Título *
3. Data
4. **Mensagem *** (novo)
5. Descrição (opcional) - para uso interno
6. Imagens (opcional)
7. Evento Recorrente

### Quick Add (adicão rápida)
O quick add continuará funcionando sem mensagem (para cadastros rápidos), mas ao clicar em "Formulário completo", a mensagem será obrigatória.
