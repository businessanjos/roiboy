

# Plano: Corrigir Preview de Documentos no Playbook

## Problema Identificado

Após investigação detalhada, descobri que o **arquivo está sendo selecionado corretamente** (os logs confirmam: "File accepted for upload"). O problema real é que **o preview do documento nunca aparece** após a seleção.

## Causa Raiz

A condição que decide se mostra o botão de upload ou o preview está **incompleta**:

```typescript
// Linha 758 - ATUAL (com bug)
{!mediaPreview && !existingMediaUrl ? (
  // Mostra botão de upload
) : (
  // Mostra preview do arquivo
)}
```

O fluxo para documentos:
1. Usuário seleciona PDF → `handleFileSelect` é chamado
2. `setMediaFile(file)` → arquivo é armazenado ✓
3. `setMediaPreview(null)` → documentos não têm preview visual (linha 239)
4. `existingMediaUrl` é `null` (não é edição)

**Resultado:** A condição `!mediaPreview && !existingMediaUrl` continua sendo `true` → botão de upload continua aparecendo em vez do preview do documento!

## Solução

Adicionar verificação de `mediaFile` na condição:

```typescript
// Linha 758 - CORRIGIDO
{!mediaFile && !mediaPreview && !existingMediaUrl ? (
  // Mostra botão de upload
) : (
  // Mostra preview do arquivo
)}
```

## Alteração Técnica

### Arquivo: `src/components/sales/PlaybookItemForm.tsx`

**Modificar linha 758:**

De:
```typescript
{!mediaPreview && !existingMediaUrl ? (
```

Para:
```typescript
{!mediaFile && !mediaPreview && !existingMediaUrl ? (
```

## Por que isso funciona

- Para imagens/stickers: `mediaPreview` é definido via FileReader → condição funciona
- Para áudio/vídeo: `mediaPreview` é definido via URL.createObjectURL → condição funciona
- Para documentos: `mediaFile` é definido, mas `mediaPreview` é `null` → **agora a verificação de `mediaFile` garante que o preview do documento apareça**

## Resultado Esperado

1. Usuário seleciona PDF no tipo "Documento"
2. Preview do documento aparece imediatamente (ícone + nome do arquivo)
3. Usuário pode ver o arquivo selecionado e prosseguir com o salvamento

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/sales/PlaybookItemForm.tsx` | Adicionar `!mediaFile &&` na condição de renderização do preview (linha 758) |

## Teste Recomendado

1. Abrir formulário de novo item no Playbook
2. Selecionar tipo "Documento"
3. Clicar na área de upload e selecionar um PDF
4. **Verificar se aparece o preview** (ícone de documento + nome do arquivo)
5. Salvar e confirmar que o upload funciona

