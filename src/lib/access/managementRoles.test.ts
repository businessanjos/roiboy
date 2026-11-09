import { describe, expect, it } from 'vitest';
import { isManagementUser } from './managementRoles';

describe('Acesso à ação de excluir perfil social', () => {
  it('libera administradores', () => {
    expect(isManagementUser({ role: 'admin' })).toBe(true);
    expect(isManagementUser({ role: 'super_admin' })).toBe(true);
  });
  it('libera gestores', () => {
    expect(isManagementUser({ role: 'user', team_role_name: 'Gerente de Marketing' })).toBe(true);
  });
  it('não libera colaboradores sem gestão', () => {
    expect(isManagementUser({ role: 'user', team_role_name: 'Analista de Marketing' })).toBe(false);
    expect(isManagementUser(null)).toBe(false);
  });
});