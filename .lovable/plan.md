# Plano: Validação de API Key nas Edge Functions

## ✅ Status: IMPLEMENTADO

**Última atualização:** 2026-02-06

---

## Arquivos Criados/Modificados

| Arquivo | Status | Descrição |
|---------|--------|-----------|
| `supabase/functions/_shared/api-key-auth.ts` | ✅ Criado | Helper de autenticação compartilhado |
| `supabase/functions/create-client/index.ts` | ✅ Atualizado | Autenticação dual JWT + API Key |
| `supabase/functions/list-clients/index.ts` | ✅ Atualizado | Autenticação dual + backward compat |
| `supabase/functions/get-client-by-phone/index.ts` | ✅ Atualizado | Auth com suporte legacy x-api-key |

---

## Arquitetura

### Fluxo de Autenticação

```text
1. Request chega com header: Authorization: Bearer roy_sk_a1b2c3...
   ↓
2. Edge Function extrai o token e calcula SHA-256 hash
   ↓
3. Busca na tabela api_keys por key_hash + is_active = true
   ↓
4. Se encontrado:
   - Atualiza last_used_at na api_keys
   - Insere log em api_key_logs (método, path, status, IP)
   - Retorna { userId, accountId } para a função usar
   ↓
5. Se não encontrado: retorna 401 Unauthorized
```

### Dual Auth Support

As Edge Functions suportam dois métodos de autenticação:
1. **JWT do Supabase** (usuários logados no frontend)
2. **API Key Admin** (automações externas com `roy_sk_...`)
3. **Legacy x-api-key** (integrações existentes - apenas get-client-by-phone)

---

## Documentação da API

### Autenticação

Todas as requisições devem incluir o header de autorização:

```
Authorization: Bearer roy_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6...
```

### Endpoints Disponíveis

#### 1. Criar Cliente

```bash
curl -X POST https://mtzoavtbtqflufyccern.supabase.co/functions/v1/create-client \
  -H "Authorization: Bearer roy_sk_SUA_CHAVE_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_e164": "+5511999999999",
    "full_name": "João Silva",
    "emails": ["joao@email.com"],
    "cpf": "123.456.789-00",
    "company_name": "Empresa do João",
    "tags": ["vip", "cliente-novo"],
    "notes": "Cliente indicado pelo marketing"
  }'
```

**Resposta (201):**
```json
{
  "success": true,
  "client": {
    "id": "uuid-do-cliente",
    "full_name": "João Silva",
    "phone_e164": "+5511999999999",
    "status": "active"
  }
}
```

#### 2. Listar Clientes

```bash
curl -X GET "https://mtzoavtbtqflufyccern.supabase.co/functions/v1/list-clients?limit=50&offset=0&search=joao" \
  -H "Authorization: Bearer roy_sk_SUA_CHAVE_AQUI"
```

**Parâmetros de Query:**
- `limit` - Máximo de resultados (1-200, padrão: 50)
- `offset` - Paginação
- `search` - Busca por nome, telefone ou empresa
- `status` - Filtro por status do cliente
- `responsible_user_id` - Filtro por responsável
- `product_id` - Filtro por produto
- `vnps_class` - Filtro por classe V-NPS (promoter/neutral/detractor)
- `contract_filter` - Filtro por status do contrato

**Resposta (200):**
```json
{
  "clients": [...],
  "total": 1180,
  "limit": 50,
  "offset": 0,
  "team_users": [...]
}
```

#### 3. Buscar Cliente por Telefone

```bash
curl -X GET "https://mtzoavtbtqflufyccern.supabase.co/functions/v1/get-client-by-phone?phone_e164=+5511999999999" \
  -H "Authorization: Bearer roy_sk_SUA_CHAVE_AQUI"
```

**Resposta (200) - Cliente encontrado:**
```json
{
  "found": true,
  "client": {
    "id": "uuid",
    "full_name": "João Silva",
    "phone_e164": "+5511999999999",
    "status": "active",
    "tags": ["vip"]
  },
  "scores": {
    "roizometer": 85,
    "escore": 72,
    "quadrant": "highE_highROI",
    "trend": "up"
  },
  "risk_events": [...],
  "recent_events": [...],
  "recommendations": [...]
}
```

**Resposta (200) - Cliente não encontrado:**
```json
{
  "found": false
}
```

---

## Códigos de Erro

| Status | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 201 | Cliente criado com sucesso |
| 400 | Payload inválido ou formato incorreto |
| 401 | Chave inválida ou revogada |
| 403 | Sem permissão para o recurso |
| 409 | Cliente já existe com este telefone |
| 500 | Erro interno do servidor |

---

## Segurança

1. **Hash SHA-256**: Chaves armazenadas como hashes, nunca em texto puro
2. **Logs de Auditoria**: Cada uso registrado com IP, método, endpoint e status
3. **Revogação Imediata**: Ao revogar uma chave, requisições subsequentes falham
4. **Escopo por Account**: Cada chave só acessa dados da conta do admin que a gerou
5. **Backward Compatibility**: Suporte a `x-api-key` legacy para integrações existentes

---

## Próximos Passos (Opcional)

- [ ] Adicionar autenticação a mais Edge Functions (sync-omie, bulk-ingest-messages)
- [ ] Implementar rate limiting por API Key
- [ ] Adicionar expiração automática de chaves
- [ ] Dashboard de analytics por chave
