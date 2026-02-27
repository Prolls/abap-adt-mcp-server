import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import { zodToJsonSchema } from "./lib/zod-to-json-schema.js";
import { allTools } from "./lib/tools/index.js";
import { disconnectAdtClient } from "./lib/adt-client.js";
import { getServerConfig, getSapConfigAsync } from "./lib/config.js";
import { logger } from "./lib/logger.js";

function configureHandlers(srv: Server): void {
  srv.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema),
      })),
    };
  });

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
}

// Map of session ID -> transport for stateful sessions
const sessions = new Map<string, StreamableHTTPServerTransport>();

async function main() {
  await getSapConfigAsync();
  const config = getServerConfig();
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      server: "abap-adt-mcp-server",
      version: "0.1.0",
      toolCount: allTools.length,
      tools: allTools.map((t) => t.name),
    });
  });

  // POST /mcp — handle JSON-RPC requests
  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      // Existing session — reuse transport
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // New session — create server + transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const server = new Server(
      { name: "abap-adt-mcp-server", version: "0.1.0" },
      { capabilities: { tools: {} } }
    );
    configureHandlers(server);

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) sessions.delete(sid);
      logger.info("Session closed", { sessionId: sid });
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    // Store session AFTER handleRequest so sessionId is assigned
    if (transport.sessionId) {
      sessions.set(transport.sessionId, transport);
      logger.info("New session created", { sessionId: transport.sessionId });
    }
  });

  // GET /mcp — SSE stream for notifications
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: "Invalid or missing session ID" });
      return;
    }
    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
  });

  // DELETE /mcp — close session
  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: "Invalid or missing session ID" });
      return;
    }
    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
    sessions.delete(sessionId);
  });

  app.listen(config.port, config.host, () => {
    logger.info("ABAP ADT MCP Server started", {
      transport: "streamable-http",
      host: config.host,
      port: config.port,
    });
    console.log(`ABAP ADT MCP Server ready at http://${config.host}:${config.port}/mcp`);
    console.log(`Health check: http://${config.host}:${config.port}/health`);
    console.log(`Tools available: ${allTools.length}`);
  });

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
