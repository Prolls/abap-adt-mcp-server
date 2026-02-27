import { z } from "zod";

// Common schemas reused across tools
export const ObjectTypeSchema = z.string().describe(
  "ABAP object type (e.g. CLAS/OC, INTF/OI, DDLS/DF, PROG/P, FUGR/F, TABL/DT, DTEL/DE, SRVD/SRV, SRVB/SVB, DCLS/DL, DDLX/EX, DEVC/K)"
);

export const TransportSchema = z.string().optional().describe(
  "Transport request number (e.g. NPLK900001). Required for non-$TMP packages."
);

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  handler: (args: unknown) => Promise<ToolResult>;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

export function jsonResult(data: unknown): ToolResult {
  return textResult(JSON.stringify(data, null, 2));
}
