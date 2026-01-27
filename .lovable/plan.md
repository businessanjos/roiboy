
# Plano: Corrigir Busca de Grupos com Acentos (Accent-Insensitive Search)

## Diagnóstico do Problema

### Causa Raiz Identificada

| Termo Buscado | Resultado |
|---------------|-----------|
| `Henrique` | Encontra o grupo |
| `Henrique & Leticia` (sem acento) | Encontra o grupo |
| `Henrique & Letícia` (com acento) | **Não encontra** |

O grupo está salvo como "**Henrique & Leticia**" (sem acento no 'i'), mas o usuário digita "**Henrique & Letícia**" (com acento). O `ILIKE` do PostgreSQL é **case-insensitive** mas **NÃO é accent-insensitive**.

### Por Que Acontece

O PostgreSQL considera `í` e `i` como caracteres diferentes. A extensão `unaccent` não está instalada no banco de dados.

## Solução Proposta: Normalização Frontend

A solução mais robusta e sem dependência de extensões do banco é **normalizar os acentos no frontend** antes de enviar a busca. Isso significa que:

- Usuário digita: `Henrique & Letícia`
- Sistema busca por: `Henrique & Leticia`

### Função de Normalização

```typescript
// Remove diacríticos/acentos de uma string
const normalizeAccents = (str: string): string => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// Exemplo:
normalizeAccents("Letícia") // → "Leticia"
normalizeAccents("João")    // → "Joao"
normalizeAccents("ação")    // → "acao"
```

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/RoyZapp.tsx` | Adicionar função de normalização e aplicar na busca |

## Detalhes Técnicos

### Modificação em `src/pages/RoyZapp.tsx`

**1. Adicionar função helper (antes de `searchContacts`):**

```typescript
// Remove diacritics/accents from string for accent-insensitive search
const normalizeAccents = (str: string): string => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};
```

**2. Aplicar normalização na variável `textSearch` (linha ~2594):**

```typescript
// Antes:
const textSearch = trimmedSearch.toLowerCase();

// Depois:
const textSearch = normalizeAccents(trimmedSearch.toLowerCase());
```

## Fluxo Corrigido

```text
┌────────────────────────────────────────────────────────────┐
│           BUSCA ACCENT-INSENSITIVE                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Usuário digita: "Henrique & Letícia"                      │
│                          │                                 │
│                          ▼                                 │
│  ┌──────────────────────────────────────────────────┐     │
│  │ normalizeAccents("henrique & letícia")           │     │
│  │ → "henrique & leticia"                           │     │
│  └──────────────────────────────────────────────────┘     │
│                          │                                 │
│                          ▼                                 │
│  Query SQL: ILIKE '%henrique & leticia%'                   │
│                          │                                 │
│                          ▼                                 │
│  ┌──────────────────────────────────────────────────┐     │
│  │ Resultado: "Henrique & Leticia - Eternum Club"   │     │
│  └──────────────────────────────────────────────────┘     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Benefícios da Solução

| Aspecto | Descrição |
|---------|-----------|
| **Sem dependência de banco** | Não requer instalação de extensões PostgreSQL |
| **Retroativo** | Funciona com todos os dados existentes |
| **Abrangente** | Aplica-se a clientes, leads, conversas e grupos |
| **Compatibilidade** | `String.normalize("NFD")` é suportado em todos os navegadores modernos |

## Casos Cobertos

| Busca do Usuário | Normalizado | Encontra |
|------------------|-------------|----------|
| "Letícia" | "Leticia" | ✅ Sim |
| "João" | "Joao" | ✅ Sim |
| "Ação" | "Acao" | ✅ Sim |
| "Fernão" | "Fernao" | ✅ Sim |
| "Müller" | "Muller" | ✅ Sim |

## Resultado Esperado

Após a implementação:
1. Usuário do setor de Operações abre "Nova Conversa"
2. Digita "Henrique & Letícia"
3. O sistema normaliza para "henrique & leticia"
4. O grupo "Henrique & Leticia - Eternum Club" aparece nos resultados
5. Usuário pode abrir o grupo e um novo assignment é criado para Operações
