import { db } from '@/db';
import { adminAudit } from '@/db/schema';
export type AdminActor = {
  id: number;
  username: string;
  role: string;
  isEditor?: boolean;
  isSuspended?: boolean;
};
export type AdminTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];
/** Call inside the same transaction as the operation; pass explicit, allowlisted details only. */
export async function writeAdminAudit(
  tx: AdminTransaction,
  actor: AdminActor,
  action: string,
  targetType: string,
  targetId: number | null,
  summary: string,
  details: Record<string, unknown> = {},
) {
  await tx.insert(adminAudit).values({
    actorId: actor.id,
    actorName: actor.username,
    action,
    targetType,
    targetId,
    summary: summary.slice(0, 300),
    details,
  });
}
