export function roleNameMatches(roleName: string | null | undefined, allowedRoles: string[]): boolean {
  if (!roleName) return false;
  const normalizedRole = roleName.toLowerCase();
  return allowedRoles.some((role) => normalizedRole.includes(role.toLowerCase()));
}

export function hasExactRole(roleName: string | null | undefined, role: string): boolean {
  return roleName?.toLowerCase() === role.toLowerCase();
}