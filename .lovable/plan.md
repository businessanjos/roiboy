

# Plano: Tornar Anexos Ilimitados nas Tarefas de Marketing

## Resumo

Remover o limite de 10 anexos por tarefa no sistema de tarefas de marketing, permitindo que os usuários anexem quantas imagens e vídeos forem necessários.

## Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/marketing/tasks/MarketingTaskMediaUpload.tsx` | Remover limite de 10 anexos |

## Alteracoes

### Remocoes

1. **Remover constante `MAX_ATTACHMENTS`** (linha 26)
2. **Remover verificacao de slots disponiveis** (linhas 92-97)
3. **Remover condicao que oculta zona de upload** (linha 216)

### Atualizacoes

1. **Label simplificado**: De `Anexos (0/10)` para `Anexos (0)` - mostrando apenas a quantidade atual
2. **Zona de upload sempre visivel**: O botao "Adicionar" sempre aparecera, independente da quantidade de anexos

## Codigo Resultante

```typescript
// Antes
const MAX_ATTACHMENTS = 10;

// Depois
// (removido - sem limite)
```

```typescript
// Antes - handleFiles
const remainingSlots = MAX_ATTACHMENTS - attachments.length;
if (fileArray.length > remainingSlots) {
  toast.error(`Máximo de ${MAX_ATTACHMENTS} anexos por tarefa...`);
  return;
}

// Depois - handleFiles
// (verificacao removida - arquivos processados diretamente)
```

```typescript
// Antes - Label
<Label>Anexos ({attachments.length}/{MAX_ATTACHMENTS})</Label>

// Depois - Label  
<Label>Anexos ({attachments.length})</Label>
```

```typescript
// Antes - Upload zone
{attachments.length < MAX_ATTACHMENTS && (
  <div className="upload-zone">...</div>
)}

// Depois - Upload zone
<div className="upload-zone">...</div>
```

## Resultado Esperado

- Usuarios poderao anexar quantos arquivos quiserem
- Label mostrara apenas a quantidade atual: "Anexos (5)"
- Botao de adicionar sempre disponivel
- Limite de 50MB por arquivo continua valido

