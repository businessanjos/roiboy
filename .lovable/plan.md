
# Plano: Tornar Email Opcional para Google Meet

## Situação Atual

O diálogo de configuração de reunião **bloqueia** a criação de reuniões Google Meet quando não há email do participante:

| Localização | Comportamento Atual |
|-------------|---------------------|
| Linha 128-131 | Valida e exibe erro se Google Meet sem email |
| Linha 275-277 | Mostra "(Opcional)" apenas para Zoom |
| Linha 282-286 | Mostra mensagem de erro apenas para Google |
| Linha 353 | Botão desabilitado se Google sem email |

**Porém**, a edge function `create-meeting` já suporta criar reuniões Google Meet sem participante:
- Linha 234: `...(participantEmail && { attendees: [{ email: participantEmail }] })` - Só adiciona participantes se email existir
- Linhas 212-217: Fallback gera link mesmo sem OAuth configurado

## Modificações Necessárias

### Arquivo: `src/components/tasks/MeetingConfigDialog.tsx`

| Linha | Mudança |
|-------|---------|
| 128-131 | Remover validação que bloqueia Google Meet sem email |
| 275-277 | Mostrar "(Opcional)" para ambas plataformas |
| 282-286 | Remover mensagem de erro específica para Google |
| 287-291 | Mostrar mesma mensagem de "compartilhar link" para ambas plataformas |
| 353 | Remover condição que desabilita botão para Google sem email |

### Detalhes Técnicos

```typescript
// ANTES (linha 128-131)
if (platform === "google" && !participantEmail) {
  toast.error("O Google Meet requer email do participante");
  return;
}

// DEPOIS - Remover este bloco completamente

// ANTES (linha 275-277)
{platform === "zoom" && (
  <span className="text-xs text-muted-foreground font-normal">(Opcional)</span>
)}

// DEPOIS - Mostrar sempre
<span className="text-xs text-muted-foreground font-normal">(Opcional)</span>

// ANTES (linha 282-291) - Dois blocos separados
{!participantEmail && platform === "google" && (
  <p className="text-xs text-destructive">O Google Meet requer email...</p>
)}
{!participantEmail && platform === "zoom" && (
  <p className="text-xs text-muted-foreground">Você poderá compartilhar...</p>
)}

// DEPOIS - Mensagem unificada
{!participantEmail && (
  <p className="text-xs text-muted-foreground">
    Você poderá compartilhar o link da reunião manualmente
  </p>
)}

// ANTES (linha 353)
disabled={loading || (platform === "google" && !participantEmail)}

// DEPOIS
disabled={loading}
```

## Resultado Esperado

1. Usuário pode criar reuniões Google Meet **sem** email do participante
2. Label "(Opcional)" aparece para ambas plataformas
3. Mensagem informativa unificada quando não há email
4. Botão "Criar Reunião" sempre habilitado (exceto durante loading)
5. Link da reunião é gerado e pode ser compartilhado manualmente
