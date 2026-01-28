
# Plano: Corrigir Criação de Campos Personalizados em Formulários

## Problema Identificado

Ao criar um novo campo personalizado no "Configurar Campos de Clientes", o toast "Campo criado!" aparece, indicando sucesso, mas o campo não é exibido na lista imediatamente.

## Análise da Causa Raiz

A investigação revelou **dois problemas** no componente `CustomFieldsManager.tsx`:

### Problema 1: `fetchFields()` sem await (Crítico)

Na função `handleSave` (linha 573), a chamada `fetchFields()` é feita **sem await**:

```typescript
toast.success("Campo criado!");
setDialogOpen(false);
resetForm();
fetchFields();        // SEM await - não espera a busca completar
onFieldsChange?.();
```

Isso causa uma race condition onde:
1. O campo é inserido no banco com sucesso
2. O toast aparece
3. O dialog fecha e o estado é resetado
4. `fetchFields()` é disparado, mas como não aguardamos, a execução continua
5. O componente pode re-renderizar antes de `fetchFields()` completar

### Problema 2: Formulário não é resetado ao ABRIR o dialog

O `resetForm()` só é chamado quando o dialog **fecha**, não quando **abre**:

```typescript
<Dialog open={dialogOpen} onOpenChange={(open) => {
  setDialogOpen(open);
  if (!open) resetForm();  // Só reseta quando fecha
}}>
```

Isso pode causar estados "sujos" de operações anteriores persistirem quando o usuário abre o dialog para criar um novo campo.

## Solução

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/custom-fields/CustomFieldsManager.tsx` | Adicionar await e resetar ao abrir |

### Mudanças Detalhadas

#### 1. Adicionar await ao fetchFields no handleSave (linhas 570-574)

```typescript
// ANTES
setDialogOpen(false);
resetForm();
fetchFields();
onFieldsChange?.();

// DEPOIS
setDialogOpen(false);
resetForm();
await fetchFields();  // Aguarda a busca completar
onFieldsChange?.();
```

#### 2. Resetar formulário quando o dialog ABRE para criar (linhas 604-607)

```typescript
// ANTES
<Dialog open={dialogOpen} onOpenChange={(open) => {
  setDialogOpen(open);
  if (!open) resetForm();
}}>

// DEPOIS
<Dialog open={dialogOpen} onOpenChange={(open) => {
  setDialogOpen(open);
  if (!open) {
    resetForm();
  } else if (!editingField) {
    // Ao abrir para CRIAR (não editar), reseta o formulário
    resetForm();
  }
}}>
```

Isso garante que quando o usuário clica "Novo Campo", o formulário sempre inicie com valores padrão corretos (fieldType = "select", options vazias, etc.).

## Fluxo Corrigido

```text
1. Usuário clica "Novo Campo"
   ↓
2. Dialog abre e resetForm() é chamado
   - fieldType = "select"
   - options = 2 opções vazias
   - name = ""
   ↓
3. Usuário preenche o formulário
   ↓
4. Usuário clica "Criar Campo"
   ↓
5. handleSave():
   - Insert no banco ✓
   - toast.success() ✓
   - setDialogOpen(false)
   - resetForm()
   - await fetchFields()  ← AGUARDA completar
   - onFieldsChange?.()
   ↓
6. Lista de campos atualizada com o novo campo ✓
```

## Validação Adicional

Também será adicionado um log de debug temporário para ajudar a identificar qualquer problema futuro:

```typescript
const { data, error } = await query;
console.log(`[fetchFields] Fetched ${data?.length || 0} fields, error:`, error);
```

Este log pode ser removido após confirmar que o problema está resolvido.

## Impacto

- Campos criados aparecerão imediatamente na lista
- O formulário sempre iniciará limpo ao criar novo campo
- Nenhuma mudança na estrutura do banco de dados
- Nenhuma mudança nas regras de negócio

## Testes Sugeridos

1. Criar um campo do tipo "Seleção única" com opções e verificar se aparece na lista
2. Criar um campo do tipo "Texto" e verificar se aparece na lista
3. Editar um campo existente e cancelar, depois criar novo - verificar se tipo está correto
4. Criar múltiplos campos em sequência e verificar se todos aparecem
