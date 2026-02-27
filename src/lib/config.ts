import dotenv from "dotenv";
import { execSync } from "node:child_process";

dotenv.config();

export interface SapConfig {
  host: string;
  user: string;
  password: string;
  client: string;
  language: string;
}

export interface ServerConfig {
  host: string;
  port: number;
}

let cachedSapConfig: SapConfig | null = null;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function promptHidden(label: string): string {
  const isWindows = process.platform === "win32";

  if (isWindows) {
    // Use PowerShell to securely read password (masked input)
    const psCommand = `$p = Read-Host -Prompt '${label}' -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))`;
    const result = execSync(`powershell -NoProfile -Command "${psCommand}"`, {
      stdio: ["inherit", "pipe", "inherit"],
    });
    return result.toString().trim();
  } else {
    // On Linux/Mac, use stty to hide input
    process.stderr.write(label);
    const result = execSync("stty -echo && read -r pw && stty echo && echo \"$pw\"", {
      stdio: ["inherit", "pipe", "inherit"],
      shell: "/bin/bash",
    });
    process.stderr.write("\n");
    return result.toString().trim();
  }
}

/**
 * Gets SAP config. Password is resolved in this order:
 * 1. SAP_PASSWORD env var (for CI/automation, never stored in files)
 * 2. Interactive prompt at startup (recommended for humans)
 */
export async function getSapConfigAsync(): Promise<SapConfig> {
  if (cachedSapConfig) return cachedSapConfig;

  const host = process.env.SAP_HOST;
  const user = process.env.SAP_USER;
  const client = process.env.SAP_CLIENT || "100";
  const language = process.env.SAP_LANGUAGE || "EN";
  let password = process.env.SAP_PASSWORD;

  if (!host) {
    throw new Error("Missing SAP_HOST environment variable (e.g. https://sap-server:44300)");
  }
  if (!user) {
    throw new Error("Missing SAP_USER environment variable");
  }

  if (!password) {
    console.log(`\n--- SAP Connection ---`);
    console.log(`Host:   ${host}`);
    console.log(`User:   ${user}`);
    console.log(`Client: ${client}`);
    password = promptHidden("Password");
    if (!password) {
      throw new Error("Password is required");
    }
    console.log("Password captured.");
  }

  cachedSapConfig = { host, user, password, client, language };
  return cachedSapConfig;
}

/** Synchronous getter — only works after getSapConfigAsync has been called */
export function getSapConfig(): SapConfig {
  if (!cachedSapConfig) {
    throw new Error("SAP config not initialized. Call getSapConfigAsync() first.");
  }
  return cachedSapConfig;
}

export function getServerConfig(): ServerConfig {
  return {
    host: process.env.MCP_HOST || "127.0.0.1",
    port: parseInt(process.env.MCP_PORT || "3122", 10),
  };
}
