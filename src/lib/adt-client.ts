import { ADTClient, session_types } from "abap-adt-api";
import { getSapConfig, type SapConfig } from "./config.js";
import { logger } from "./logger.js";

let client: ADTClient | null = null;
let loggedIn = false;

export function createAdtClient(config?: SapConfig): ADTClient {
  const cfg = config || getSapConfig();
  return new ADTClient(
    cfg.host,
    cfg.user,
    cfg.password,
    cfg.client,
    cfg.language
  );
}

export async function getAdtClient(): Promise<ADTClient> {
  if (client && loggedIn) {
    return client;
  }

  const cfg = getSapConfig();
  logger.info("Connecting to SAP system", { host: cfg.host, client: cfg.client, user: cfg.user });

  client = createAdtClient(cfg);
  await client.login();
  client.stateful = session_types.stateful;
  loggedIn = true;

  logger.info("Connected to SAP system successfully");
  return client;
}

export async function ensureLoggedIn(): Promise<ADTClient> {
  try {
    return await getAdtClient();
  } catch (err: unknown) {
    // If session expired, reset and retry once
    logger.warn("ADT session may have expired, retrying login", {
      error: err instanceof Error ? err.message : String(err),
    });
    client = null;
    loggedIn = false;
    return await getAdtClient();
  }
}

export async function disconnectAdtClient(): Promise<void> {
  if (client && loggedIn) {
    try {
      await client.logout();
    } catch {
      // ignore logout errors
    }
    client = null;
    loggedIn = false;
    logger.info("Disconnected from SAP system");
  }
}
