
# Plano: Adicionar Opção "Não Enviar" ao Dropdown de Convite

## Alteração Proposta

Adicionar a opção "Não Enviar" ao dropdown "Quando enviar o convite" no componente `MeetingConfigDialog`.

## Arquivo a Modificar

**src/components/tasks/MeetingConfigDialog.tsx**

## Alterações

### 1. Adicionar a opção no array de opções (linha 20-25)

```typescript
const EMAIL_ADVANCE_OPTIONS = [
  { value: "none", label: "Não enviar" },        // <-- NOVA OPÇÃO
  { value: "immediate", label: "Enviar agora" },
  { value: "10min", label: "10 minutos antes" },
  { value: "1hour", label: "1 hora antes" },
  { value: "1day", label: "1 dia antes" },
];
```

### 2. Ajustar a lógica para não enviar email quando selecionado "none" (linha 184)

Na função `handleCreateMeeting`, ajustar para considerar `emailAdvance === "none"` como não enviar:

```typescript
send_email: sendEmail && emailAdvance !== "none",
```

### 3. Ajustar o toast de confirmação (linhas 200-210)

Adicionar tratamento para quando "Não enviar" for selecionado:

```typescript
if (sendEmail && participantEmail && emailAdvance !== "none") {
  // lógica existente de toasts de envio
} else if (emailAdvance === "none") {
  toast.info("Reunião criada sem envio de convite por email");
} else if (!participantEmail) {
  toast.info("Compartilhe o link da reunião com o participante");
} else {
  toast.info("Reunião criada sem envio de convite por email");
}
```

### 4. Ocultar campo de mensagem quando "Não enviar" selecionado (linha 305)

Ajustar a condição para mostrar as opções de email:

```typescript
{sendEmail && emailAdvance !== "none" && (
  <>
    {/* Email Message */}
    ...
  </>
)}
```

Mas manter o dropdown visível para permitir alterar a opção.

## Resultado Esperado

O dropdown "Quando enviar o convite" terá as seguintes opções:
- ⚪ Não enviar
- Enviar agora
- 10 minutos antes
- 1 hora antes
- 1 dia antes

Quando "Não enviar" for selecionado:
- O campo de mensagem será ocultado
- A reunião será criada sem envio de email
- O usuário receberá a confirmação de que não foi enviado convite
