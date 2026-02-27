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

export const deleteBreakpoints: ToolDefinition = {
  name: "debug_delete_breakpoints",
  description: "Delete a breakpoint from the debugger.",
  inputSchema: z.object({
    terminalId: z.string().describe("Terminal ID"),
    ideId: z.string().describe("IDE ID"),
    breakpoint: z.object({
      kind: z.string().describe("Breakpoint kind"),
      clientId: z.string().describe("Client ID"),
      id: z.string().describe("Breakpoint ID"),
      uri: z.object({
        uri: z.string().describe("Object URI"),
        start: z.object({ line: z.number(), column: z.number() }).optional(),
        end: z.object({ line: z.number(), column: z.number() }).optional(),
      }).describe("URI parts for the breakpoint location"),
      type: z.string().describe("Breakpoint type (e.g. line, statement)"),
      name: z.string().describe("Breakpoint name"),
      condition: z.string().optional().describe("Breakpoint condition"),
      nonAbapFlavour: z.string().optional().describe("Non-ABAP flavour"),
    }).describe("Breakpoint object to delete"),
    user: z.string().optional().describe("User name"),
  }),
  handler: async (args: unknown) => {
    const { terminalId, ideId, breakpoint, user } = args as {
      terminalId: string; ideId: string; breakpoint: any; user?: string;
    };
    const client = await ensureLoggedIn();
    logger.info("Deleting breakpoint", { id: breakpoint.id });
    await client.debuggerDeleteBreakpoints(
      breakpoint, "user", terminalId, ideId, user || client.username
    );
    return textResult(`Breakpoint ${breakpoint.id} deleted.`);
  },
};

export const debugAttach: ToolDefinition = {
  name: "debug_attach",
  description: "Attach to a running debug session. Call this after debug_listen returns a debuggee.",
  inputSchema: z.object({
    debuggeeId: z.string().describe("Debuggee ID returned by debug_listen"),
    user: z.string().optional().describe("User name"),
    dynproDebugging: z.boolean().optional().describe("Enable Dynpro debugging"),
  }),
  handler: async (args: unknown) => {
    const { debuggeeId, user, dynproDebugging } = args as {
      debuggeeId: string; user?: string; dynproDebugging?: boolean;
    };
    const client = await ensureLoggedIn();
    logger.info("Attaching to debuggee", { debuggeeId });
    const result = await client.debuggerAttach(
      "user", debuggeeId, user || client.username, dynproDebugging
    );
    return jsonResult(result);
  },
};

export const debugStackTrace: ToolDefinition = {
  name: "debug_stack_trace",
  description: "Get the current call stack of the active debug session. Shows program names, includes, line numbers, and event names.",
  inputSchema: z.object({
    semanticURIs: z.boolean().optional().describe("Use semantic URIs (default false)"),
  }),
  handler: async (args: unknown) => {
    const { semanticURIs } = args as { semanticURIs?: boolean };
    const client = await ensureLoggedIn();
    logger.info("Getting debug stack trace");
    const result = await client.debuggerStackTrace(semanticURIs);
    return jsonResult(result);
  },
};

export const debugVariables: ToolDefinition = {
  name: "debug_variables",
  description: "Inspect variables in the current debug session. Returns variable names, types, values, and metadata.",
  inputSchema: z.object({
    parents: z.array(z.string()).describe("List of variable paths to inspect (e.g. ['LV_RESULT', 'LS_STRUCT'])"),
  }),
  handler: async (args: unknown) => {
    const { parents } = args as { parents: string[] };
    const client = await ensureLoggedIn();
    logger.info("Getting debug variables", { count: parents.length });
    const result = await client.debuggerVariables(parents);
    return jsonResult(result);
  },
};

export const debugChildVariables: ToolDefinition = {
  name: "debug_child_variables",
  description: "Get child variables of a complex variable (structure fields, table rows, object attributes) in the current debug session.",
  inputSchema: z.object({
    parent: z.array(z.string()).optional().describe("Parent variable path(s) to expand"),
  }),
  handler: async (args: unknown) => {
    const { parent } = args as { parent?: string[] };
    const client = await ensureLoggedIn();
    logger.info("Getting child variables");
    const result = await client.debuggerChildVariables(parent);
    return jsonResult(result);
  },
};

export const debugStep: ToolDefinition = {
  name: "debug_step",
  description: "Execute a debug step action: step into, step over, step return, continue execution, or terminate the debuggee.",
  inputSchema: z.object({
    stepType: z.enum(["stepInto", "stepOver", "stepReturn", "stepContinue", "terminateDebuggee", "stepRunToLine", "stepJumpToLine"])
      .describe("Type of step action to perform"),
    url: z.string().optional().describe("Target URL (required for stepRunToLine and stepJumpToLine)"),
  }),
  handler: async (args: unknown) => {
    const { stepType, url } = args as { stepType: string; url?: string };
    const client = await ensureLoggedIn();
    logger.info("Debug step", { stepType });
    let result;
    if ((stepType === "stepRunToLine" || stepType === "stepJumpToLine") && url) {
      result = await client.debuggerStep(stepType as "stepRunToLine" | "stepJumpToLine", url);
    } else {
      result = await client.debuggerStep(stepType as "stepInto");
    }
    return jsonResult(result);
  },
};

export const debugSetVariable: ToolDefinition = {
  name: "debug_set_variable",
  description: "Modify the value of a variable during an active debug session.",
  inputSchema: z.object({
    variableName: z.string().describe("Name of the variable to modify"),
    value: z.string().describe("New value to assign"),
  }),
  handler: async (args: unknown) => {
    const { variableName, value } = args as { variableName: string; value: string };
    const client = await ensureLoggedIn();
    logger.info("Setting debug variable", { variableName });
    const result = await client.debuggerSetVariableValue(variableName, value);
    return textResult(result || `Variable ${variableName} set to "${value}".`);
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
  deleteBreakpoints,
  debugAttach,
  debugStackTrace,
  debugVariables,
  debugChildVariables,
  debugStep,
  debugSetVariable,
  getTraces,
];
