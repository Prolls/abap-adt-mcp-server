import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { format } from "node:util";
import { zodToJsonSchema } from "./lib/zod-to-json-schema.js";
import { allTools } from "./lib/tools/index.js";
import { disconnectAdtClient } from "./lib/adt-client.js";
import { logger } from "./lib/logger.js";

// Redirect console to stderr so STDIO transport is clean
const writeToStderr = (...args: unknown[]) => {
  process.stderr.write(format(...args) + "\n");
};
console.log = writeToStderr;
console.info = writeToStderr;
console.debug = writeToStderr;

function createServer(): Server {
  const srv = new Server(
    {
      name: "abap-adt-mcp-server",
      description: "MCP server for autonomous ABAP development via SAP ADT REST APIs. Supports creating, modifying, testing, and activating ABAP objects.",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List all available tools
  srv.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema),
      })),
    };
  });

  // Handle tool calls
  srv.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = allTools.find((t) => t.name === name);

    if (!tool) {
      return { content: [{ type: "text" as const, text: `Error: Unknown tool: ${name}` }], isError: true };
    }

    try {
      logger.info("Tool called", { tool: name });
      const result = await tool.handler(args);
      logger.info("Tool completed", { tool: name, isError: result.isError });
      return { content: result.content, isError: result.isError };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Tool failed", { tool: name, error: message });
      return { content: [{ type: "text" as const, text: `Error: Tool "${name}" failed: ${message}` }], isError: true };
    }
  });

  return srv;
}

async function main() {
  logger.info("ABAP ADT MCP Server starting", { transport: "stdio", pid: process.pid });

  // Prompt for password before starting STDIO transport (uses stderr for prompts)
  const { getSapConfigAsync } = await import("./lib/config.js");
  await getSapConfigAsync();

  const srv = createServer();
  await srv.connect(new StdioServerTransport());

  console.error("ABAP ADT MCP Server ready (stdio). Tools available: " + allTools.length);

  process.on("SIGINT", async () => {
    logger.info("Shutdown signal received");
    await disconnectAdtClient();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
