
# Plano: Exibir Botão "Testar envio" Sempre ao Editar

## Objetivo

Alterar a condição de exibição do botão "Testar envio" para que ele apareça sempre que um Momento CX existente estiver sendo editado, independentemente do toggle "Enviar automaticamente".

## Arquivo a Modificar

`src/components/clients/ClientLifeEvents.tsx`

## Mudança

### Condição Atual (linha ~469)
```tsx
{editingEvent && formAutoSend && (
  <Popover>
    ...
  </Popover>
)}
```

### Nova Condição
```tsx
{editingEvent && (
  <Popover>
    ...
  </Popover>
)}
```

## Justificativa

O botão de teste é útil para verificar se a mensagem e imagem estão configuradas corretamente, mesmo quando o envio automático não está ativado. Isso permite:

- Testar a formatação da mensagem antes de ativar o envio automático
- Verificar se a imagem anexada será enviada corretamente
- Validar as variáveis como `{nome}` e `{primeiro_nome}`

## Impacto

| Antes | Depois |
|-------|--------|
| Botão visível apenas com toggle ativo | Botão visível sempre ao editar momento existente |
| Usuário precisa ativar toggle para testar | Teste disponível independente da configuração |

