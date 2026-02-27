import { z } from "zod";
import { ensureLoggedIn } from "../adt-client.js";
import { type ToolDefinition, textResult, jsonResult } from "../../types/index.js";
import { logger } from "../logger.js";

export const readTableContents: ToolDefinition = {
  name: "read_table_contents",
  description: "Read contents of a database table or CDS view. Useful for debugging and testing. Returns rows as JSON.",
  inputSchema: z.object({
    tableName: z.string().describe("Table or CDS view name"),
    maxRows: z.number().optional().default(100).describe("Maximum rows to return (default 100)"),
  }),
  handler: async (args: unknown) => {
    const { tableName, maxRows } = args as { tableName: string; maxRows: number };
    const client = await ensureLoggedIn();
    logger.info("Reading table contents", { tableName, maxRows });
    const contents = await client.tableContents(tableName.toUpperCase(), maxRows);
    return jsonResult(contents);
  },
};

export const publishServiceBinding: ToolDefinition = {
  name: "publish_service_binding",
  description: "Publish an OData service binding, making it available for consumption. Required after creating a service binding.",
  inputSchema: z.object({
    bindingName: z.string().describe("Service binding name"),
    version: z.string().default("0001").describe("Service version (default 0001)"),
  }),
  handler: async (args: unknown) => {
    const { bindingName, version } = args as { bindingName: string; version: string };
    const client = await ensureLoggedIn();
    logger.info("Publishing service binding", { bindingName, version });
    const result = await client.publishServiceBinding(bindingName, version);
    return jsonResult({ message: `Service binding ${bindingName} published.`, result });
  },
};

export const unpublishServiceBinding: ToolDefinition = {
  name: "unpublish_service_binding",
  description: "Unpublish an OData service binding.",
  inputSchema: z.object({
    bindingName: z.string().describe("Service binding name"),
    version: z.string().default("0001").describe("Service version (default 0001)"),
  }),
  handler: async (args: unknown) => {
    const { bindingName, version } = args as { bindingName: string; version: string };
    const client = await ensureLoggedIn();
    logger.info("Unpublishing service binding", { bindingName, version });
    const result = await client.unPublishServiceBinding(bindingName, version);
    return jsonResult({ message: `Service binding ${bindingName} unpublished.`, result });
  },
};

export const dataServicesTools: ToolDefinition[] = [
  readTableContents,
  publishServiceBinding,
  unpublishServiceBinding,
];
