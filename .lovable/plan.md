
# Correção: Timeout no Deploy da Edge Function uazapi-manager

## Problema Identificado

A Edge Function `uazapi-manager` **não está deployada** (retorna 404) porque o processo de bundling está dando **timeout**. O arquivo `index.ts` tem **4.140 linhas** - muito grande para o processo de build do Deno.

### Evidências:
- Requisições retornam `"Error: Failed to fetch"` no frontend
- Chamada direta à função retorna `404 NOT_FOUND`
- Deploy manual retorna `"Bundle generation timed out"`

---

## Solução: Modularização da Edge Function

Dividir o arquivo monolítico em módulos menores para reduzir o tempo de bundling.

### Estrutura Proposta

```
supabase/functions/uazapi-manager/
├── index.ts           (~300 linhas - router principal)
├── lib/
│   ├── cors.ts        (~15 linhas)
│   ├── auth.ts        (~60 linhas)
│   ├── uazapi-client.ts (~200 linhas - helpers de request)
│   ├── audit-logger.ts  (~80 linhas)
│   └── webhook-config.ts (~100 linhas)
└── handlers/
    ├── instance.ts    (~400 linhas - create, connect, disconnect, status, qrcode)
    ├── messaging.ts   (~500 linhas - send_text, send_media, etc)
    ├── groups.ts      (~400 linhas - list_groups, sync_groups, etc)
    ├── sector.ts      (~300 linhas - add_instance_to_sector, list_sector_instances)
    └── sync.ts        (~400 linhas - sync-chat-history, import-conversations)
```

### Estratégia de Migração

**Passo 1**: Extrair módulos utilitários para `/lib`
- CORS headers
- Funções de autenticação
- Cliente UAZAPI (uazapiAdminRequest, uazapiInstanceRequest, etc)
- Logger de auditoria
- Configuração de webhook

**Passo 2**: Extrair handlers por domínio para `/handlers`
- Agrupar cases do switch por funcionalidade
- Cada handler exporta uma função que recebe (supabase, userData, payload)

**Passo 3**: Simplificar index.ts
- Apenas validação inicial e roteamento
- Import dinâmico dos handlers

---

## Benefícios

1. **Build mais rápido**: Arquivos menores = bundling mais rápido
2. **Manutenibilidade**: Código organizado por funcionalidade
3. **Testabilidade**: Handlers isolados facilitam testes
4. **Reusabilidade**: Módulos lib podem ser importados por outras funções

---

## Arquivos a Criar

| Arquivo | Responsabilidade |
|---------|------------------|
| `lib/cors.ts` | Headers CORS |
| `lib/auth.ts` | Validação de autenticação |
| `lib/uazapi-client.ts` | Funções de request para UAZAPI |
| `lib/audit-logger.ts` | Log de auditoria e notificações |
| `lib/webhook-config.ts` | Configuração automática de webhook |
| `handlers/instance.ts` | Actions: create, connect, disconnect, status, qrcode, paircode |
| `handlers/messaging.ts` | Actions: send_text, send_media, send_to_group, delete_message, edit_message |
| `handlers/groups.ts` | Actions: list_groups, sync_groups, save_selected_groups, create_group, group_participants |
| `handlers/sector.ts` | Actions: add_instance_to_sector, update_instance_pin, verify_instance_pin, list_sector_instances, list_instances, link_instance |
| `handlers/sync.ts` | Actions: sync-chat-history, import-conversations |

---

## Estimativa de Tamanho Final

| Arquivo | Linhas |
|---------|--------|
| index.ts | ~250 |
| lib/* (5 arquivos) | ~450 total |
| handlers/* (5 arquivos) | ~2000 total |
| **Total** | ~2700 (35% menor) |

O mais importante é que o arquivo principal `index.ts` terá apenas ~250 linhas, reduzindo drasticamente o tempo de bundling.
