

# Plano: Corrigir Acesso ao ROY zAPP para Usuários com Cargo CX

## Problema Identificado

A usuária Maria (cargo CX) não consegue acessar o ROY zAPP no setor de Operações, mesmo tendo:
- Permissão `royzapp.access` configurada no cargo CX
- Registro ativo em `user_sector_access` para o setor `operacoes`
- Cargo CX que deveria ter acesso automático ao setor de Operações

## Causa Raiz

Existe uma **inconsistência arquitetural** entre dois hooks que verificam acesso a setores:

| Hook | Lógica de Bypass por Cargo | Usado por |
|------|---------------------------|-----------|
| `useUserSectorAccess.tsx` | Concede acesso automático ao setor `operacoes` para cargos CX, CS, Consultor | Outras partes do sistema |
| `useSectorAccess.tsx` | **NAO TEM** essa lógica | ROY zAPP / ZappSectorSelector |

O hook `useSectorAccess` (usado pelo ROY zAPP) verifica apenas:
1. Se e super_admin (para diretoria)
2. Se `role === "admin"`
3. Se tem registro explicito em `user_sector_access`

**Falta a verificacao de cargo (team_role_name)** que permite bypass automatico para CX, CS, Consultor no setor de operacoes.

## Solucao Proposta

Adicionar a mesma logica de bypass por cargo no hook `useSectorAccess.tsx` que ja existe no `useUserSectorAccess.tsx` e no `Sidebar.tsx`.

## Alteracoes Tecnicas

### Arquivo: `src/hooks/useSectorAccess.tsx`

**1. Adicionar constante para cargos de operacao (antes da funcao):**
```typescript
const OPERATION_TEAM_ROLES = ["CX", "CS", "Consultor"];
```

**2. Obter team_role_name do currentUser:**
```typescript
const teamRoleName = currentUser?.team_role_name;
```

**3. Modificar a funcao `hasSectorAccess` para incluir verificacao de cargo:**

De:
```typescript
const hasSectorAccess = (sectorId: SectorId): boolean => {
  if (sectorId === "diretoria") {
    return isSuperAdmin;
  }
  if (userRole === "admin") return true;
  return sectorAccess.some((access) => access.sector_id === sectorId);
};
```

Para:
```typescript
const hasSectorAccess = (sectorId: SectorId): boolean => {
  if (sectorId === "diretoria") {
    return isSuperAdmin;
  }
  if (userRole === "admin") return true;
  
  // Bypass para cargos de operacao no setor de operacoes
  if (sectorId === "operacoes" && teamRoleName) {
    if (OPERATION_TEAM_ROLES.includes(teamRoleName)) {
      return true;
    }
  }
  
  return sectorAccess.some((access) => access.sector_id === sectorId);
};
```

## Resultado Esperado

Apos a correcao:
1. Usuarios com cargo CX, CS ou Consultor terao acesso automatico ao setor de Operacoes no ROY zAPP
2. Maria podera ver e selecionar o setor de Operacoes no seletor de setores
3. A consistencia entre os hooks sera mantida

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useSectorAccess.tsx` | Adicionar logica de bypass por cargo para setor de operacoes |

## Nota sobre Consistencia

Esta correcao alinha o comportamento do `useSectorAccess` com o `useUserSectorAccess` e o `Sidebar`, garantindo que:
- Cargos CX, CS, Consultor sempre tenham acesso ao setor de Operacoes
- A experiencia do usuario seja consistente em toda a plataforma

