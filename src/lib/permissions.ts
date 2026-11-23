export type PermissionUser =
  | { role: string; isEditor?: boolean; isSuspended?: boolean }
  | null
  | undefined;
export const isAdministrator = (user: PermissionUser) =>
  !!user && !user.isSuspended && user.role === 'admin';
export const canModerate = (user: PermissionUser) =>
  !!user && !user.isSuspended && ['admin', 'moderator'].includes(user.role);
// Editor is an independent capability, not a role or a privilege to edit other people's catalogue.
export const canCreateMaterial = (user: PermissionUser) =>
  !!user &&
  !user.isSuspended &&
  (['admin', 'moderator'].includes(user.role) || user.isEditor === true);
export const canAccessAdmin = (user: PermissionUser) =>
  canModerate(user) || canCreateMaterial(user);
export function permissionsFor(user: PermissionUser) {
  return {
    access: canAccessAdmin(user),
    create: canCreateMaterial(user),
    edit: canModerate(user),
    moderate: canModerate(user),
    manageUsers: isAdministrator(user),
    curate: isAdministrator(user),
    audit: isAdministrator(user),
  };
}
export function sessionIsCurrent(
  user: { isSuspended?: boolean; sessionVersion?: number },
  version: unknown,
) {
  return (
    !user.isSuspended &&
    (version === undefined ? 0 : version) === (user.sessionVersion ?? 0)
  );
}
