
# Plano: Exibir Nome do Usuário nos Anexos da Timeline

## Situação Atual

Na timeline do perfil do cliente (setor Operações), quando um documento ou imagem é anexado, a interface exibe apenas:
- Nome do arquivo
- Tipo do documento
- Tamanho do arquivo
- Data do upload

**Porém**, o nome do usuário que fez o upload **já está disponível** nos dados (`event.metadata.user_name`), mas não está sendo renderizado na interface.

| Componente | Exibe Usuário? | Local |
|------------|----------------|-------|
| `CommentItem` (notas de texto) | ✅ Sim | Linha 316 |
| `SystemEventItem` (anexos/documentos) | ❌ Não | Linhas 536-551 |

## Modificações Necessárias

### Arquivo: `src/components/client/Timeline.tsx`

A função `SystemEventItem` (linha 485) precisa ser modificada para exibir o nome do usuário que anexou o documento, de forma similar ao `CommentItem`.

#### Localização Exata
O bloco de informações do item está entre as linhas **534-551**. A modificação será feita para incluir o nome do usuário logo abaixo do label de categoria:

```typescript
// ANTES (linhas 537-551)
<div className="flex items-center gap-1.5 mt-0.5">
  <span className={cn("text-xs font-medium", config.textColor)}>
    {config.label}
  </span>
  {event.metadata?.source && (
    <>
      <span className="text-muted-foreground">·</span>
      <span className="text-xs text-muted-foreground">
        {event.metadata.source === "whatsapp_text" ? "WhatsApp" : ...}
      </span>
    </>
  )}
</div>

// DEPOIS - Adicionar nome do usuário para tipos followup, financial e sales
<div className="flex items-center gap-1.5 mt-0.5">
  <span className={cn("text-xs font-medium", config.textColor)}>
    {config.label}
  </span>
  {/* NOVO: Exibir nome do usuário que anexou */}
  {(event.type === "followup" || event.type === "financial" || event.type === "sales") && 
    event.metadata?.user_name && (
    <>
      <span className="text-muted-foreground">·</span>
      <span className="text-xs text-muted-foreground">
        por {event.metadata.user_name}
      </span>
    </>
  )}
  {event.metadata?.source && (
    // ... resto do código existente
  )}
</div>
```

## Resultado Visual

### Antes:
```
📎 planilha faturamento (1).xlsx
   Acompanhamento
   └── Planilha Excel · 78.2 KB                      ⬇️  cerca de 16 horas
```

### Depois:
```
📎 planilha faturamento (1).xlsx
   Acompanhamento · por Maria
   └── Planilha Excel · 78.2 KB                      ⬇️  cerca de 16 horas
```

## Resumo das Alterações

| Local | Mudança |
|-------|---------|
| Linhas 537-551 | Adicionar exibição do `user_name` para eventos de tipo `followup`, `financial` e `sales` |

## Resultado Esperado

1. ✅ Documentos anexados mostrarão "Acompanhamento · por [Nome do Usuário]"
2. ✅ Notas financeiras mostrarão "Nota Financeira · por [Nome do Usuário]"
3. ✅ Notas de vendas mostrarão "Nota de Vendas · por [Nome do Usuário]"
4. ✅ Eventos do sistema (ROI, riscos, etc.) continuam sem alteração
5. ✅ Mantida a compatibilidade com eventos que não têm usuário associado
