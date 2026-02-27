import { z } from "zod";
import { ensureLoggedIn } from "../adt-client.js";
import { type ToolDefinition, textResult, jsonResult } from "../../types/index.js";
import { logger } from "../logger.js";

export const debugListen: ToolDefinition = {
  name: "debug_listen",
  description: "Start listening for debug sessions. WARNING: this call blocks until a breakpoint is hit or timeout. Requires terminalId and ideId.",
  inputSchema: z.object({
    terminalId: z.string().describe("Terminal ID (GUID from SAP debugging config)"),
    ideId: z.string().describe("IDE ID (workspace hash)"),
    user: z.string().optional().describe("User to debug for (required for user mode)"),
  }),
  handler: async (args: unknown) => {
    const { terminalId, ideId, user } = args as { terminalId: string; ideId: string; user?: string };
    const client = await ensureLoggedIn();
    logger.info("Starting debug listener");
    const result = await client.debuggerListen("user", terminalId, ideId, user || client.username);
    return jsonResult(result);
  },
};

export const setBreakpoints: ToolDefinition = {
  name: "set_breakpoints",
  description: "Set breakpoints in ABAP source code for debugging.",
  inputSchema: z.object({
    terminalId: z.string().describe("Terminal ID"),
    ideId: z.string().describe("IDE ID"),
    clientId: z.string().describe("Client ID for the debug session"),
    breakpoints: z.array(z.string()).describe("Array of breakpoint URIs or source positions"),
    user: z.string().optional().describe("User name"),
  }),
  handler: async (args: unknown) => {
    const { terminalId, ideId, clientId, breakpoints, user } = args as {
      terminalId: string; ideId: string; clientId: string; breakpoints: string[]; user?: string;
    };
    const client = await ensureLoggedIn();
    logger.info("Setting breakpoints", { count: breakpoints.length });
    const result = await client.debuggerSetBreakpoints(
      "user", terminalId, ideId, clientId, breakpoints, user || client.username
    );
    return jsonResult(result);
  },
};

export const getTraces: ToolDefinition = {
  name: "get_traces",
  description: "List available runtime traces. Shows execution traces for performance analysis.",
  inputSchema: z.object({
    user: z.string().optional().describe("Filter by user"),
  }),
  handler: async (args: unknown) => {
    const { user } = args as { user?: string };
    const client = await ensureLoggedIn();
    const traces = await client.tracesList(user);
    return jsonResult(traces);
  },
};

export const debugTools: ToolDefinition[] = [
  debugListen,
  setBreakpoints,
  getTraces,
];
