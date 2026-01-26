
# Plano: Sincronizar Nome do Header com a Sidebar no ROY zAPP

## Problema Identificado

A imagem mostra uma discrepância clara:

| Local | Nome Exibido |
|-------|--------------|
| **Sidebar** (esquerda) | "Thiago & Jamile - Rykas Mentoring" ✓ |
| **Header** (chat aberto) | "Thiago Almeida" ✗ |

A causa raiz é a existência de **duas implementações diferentes** da função `getContactInfo`:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                     SITUAÇÃO ATUAL - DUPLICAÇÃO DE LÓGICA                  │
└────────────────────────────────────────────────────────────────────────────┘

   src/components/royzapp/types.ts                  src/pages/RoyZapp.tsx
          (SIDEBAR)                                      (HEADER)
   ┌─────────────────────────────┐           ┌─────────────────────────────┐
   │ getContactInfo()            │           │ getContactInfo() (diferente)│
   │                             │           │                             │
   │ Para GRUPOS:                │           │ Para TODOS:                 │
   │ → contact_name (grupo)      │           │ → client.full_name          │
   │                             │           │ → lead.full_name            │
   │ Para INDIVIDUAIS:           │           │ → contact_name              │
   │ → client.full_name          │           │                             │
   │ → lead.full_name            │           │ NÃO diferencia grupos!      │
   │ → contact_name              │           │                             │
   └─────────────────────────────┘           └─────────────────────────────┘
           │                                          │
           ▼                                          ▼
   "Thiago & Jamile - Rykas"               "Thiago Almeida"
   (nome do grupo no WhatsApp)             (nome do cliente vinculado)
```

---

## Solução

Atualizar a função `getContactInfo` em `RoyZapp.tsx` para usar a **mesma lógica** de `types.ts`, diferenciando grupos de conversas individuais:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                     SOLUÇÃO - LÓGICA UNIFICADA                             │
└────────────────────────────────────────────────────────────────────────────┘

   src/pages/RoyZapp.tsx (ATUALIZADO)
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ getContactInfo()                                                        │
   │                                                                         │
   │ if (zc?.is_group) {                                                     │
   │   → contact_name (nome do grupo) OU "Grupo sem nome"                    │
   │ } else {                                                                │
   │   → client.full_name                                                    │
   │   → lead.full_name                                                      │
   │   → contact_name                                                        │
   │   → phone_e164                                                          │
   │   → "Desconhecido"                                                      │
   │ }                                                                       │
   └─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
   RESULTADO: Sidebar e Header exibem o mesmo nome
```

---

## Alteração Específica

### Arquivo: `src/pages/RoyZapp.tsx`

Localização: Função `getContactInfo` (linhas 1114-1149)

**Antes (linha 1118):**
```typescript
const name = zc?.client?.full_name || zc?.lead?.full_name || zc?.contact_name || c?.full_name || "Contato";
```

**Depois:**
```typescript
// IMPORTANTE: Para GRUPOS, sempre usar contact_name (nome do grupo no WhatsApp)
// Para conversas individuais, priorizar cliente/lead vinculado
// Isso mantém consistência entre sidebar e header
const name = zc?.is_group 
  ? (zc?.contact_name || "Grupo sem nome")
  : (zc?.client?.full_name || zc?.lead?.full_name || zc?.contact_name || c?.full_name || zc?.phone_e164 || "Desconhecido");
```

---

## Resultado Esperado

| Tipo de Conversa | Sidebar | Header | Consistente? |
|------------------|---------|--------|--------------|
| **Grupo** (ex: "Thiago & Jamile - Rykas") | Nome do grupo | Nome do grupo | ✓ |
| **Individual com cliente** | Nome do cliente | Nome do cliente | ✓ |
| **Individual com lead** | Nome do lead | Nome do lead | ✓ |
| **Sem vínculo** | Nome do contato/telefone | Nome do contato/telefone | ✓ |

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/RoyZapp.tsx` | Atualizar lógica de `name` na função `getContactInfo` (linha 1118) para diferenciar grupos de conversas individuais |
