import type { ADTClient } from "abap-adt-api";
import { logger } from "../logger.js";

export interface LockResult {
  lockHandle: string;
  transport?: string;
}

/**
 * Acquires a lock on an ABAP object, executes the action, then releases the lock.
 * Ensures cleanup even on error.
 */
export async function withLock<T>(
  client: ADTClient,
  objectUrl: string,
  action: (lockHandle: string, transport?: string) => Promise<T>
): Promise<T> {
  logger.debug("Acquiring lock", { objectUrl });
  const lock = await client.lock(objectUrl);
  const lockHandle = lock.LOCK_HANDLE;
  const transport = lock.CORRNR || undefined;
  logger.debug("Lock acquired", { objectUrl, lockHandle, transport });

  try {
    const result = await action(lockHandle, transport);
    return result;
  } finally {
    try {
      await client.unLock(objectUrl, lockHandle);
      logger.debug("Lock released", { objectUrl });
    } catch (unlockErr: unknown) {
      logger.warn("Failed to release lock", {
        objectUrl,
        error: unlockErr instanceof Error ? unlockErr.message : String(unlockErr),
      });
    }
  }
}
