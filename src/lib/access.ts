import { useAuth } from '@/lib/auth-context';
import type { HostTeamPermission } from '@/lib/api';

/**
 * The single place the mobile app decides what a host-side user may see.
 * Mirrors the backend's rules so a screen never offers something the API
 * will refuse — but it is only ever a convenience: every gate here has a
 * matching guard server-side (HostRoleGuard / HostPermissionGuard), and
 * hiding a button is never what actually protects the data.
 *
 * The ladder is OWNER > MANAGER > STAFF:
 *  - OWNER   — the account holder. The only one who can connect Airbnb.
 *  - MANAGER — a co-host with full operational + financial access.
 *  - STAFF   — a co-host limited to the permissions the owner ticked.
 *
 * A missing role (an old stored session, or a non-host) is treated as the
 * owner. That's the fail-open direction on purpose: it only ever affects
 * the account holder's own session, and the server still enforces.
 */
export function useHostAccess() {
  const { session } = useAuth();
  const role = session?.user.hostRole ?? 'OWNER';
  const permissions = session?.user.hostPermissions ?? [];

  const isOwner = role === 'OWNER';
  const isStaff = role === 'STAFF';
  /** OWNER or MANAGER — "full access" in the product's terms. */
  const isManager = role === 'OWNER' || role === 'MANAGER';

  /** OWNER/MANAGER implicitly have every permission; STAFF only what was granted. */
  const has = (permission: HostTeamPermission) => !isStaff || permissions.includes(permission);

  return { role, isOwner, isManager, isStaff, has };
}
