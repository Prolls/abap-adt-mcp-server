import { z } from "zod";
import { ensureLoggedIn } from "../adt-client.js";
import { getObjectUrl } from "../helpers/url-builder.js";
import { type ToolDefinition, ObjectTypeSchema, textResult, jsonResult } from "../../types/index.js";
import { logger } from "../logger.js";

export const listDumps: ToolDefinition = {
  name: "list_dumps",
  description: "List ABAP runtime dumps (ST22). Shows short dumps with error type, program, and timestamp. Useful for diagnosing runtime errors.",
  inputSchema: z.object({
    query: z.string().optional().describe("Filter query (e.g. date range, user, program)"),
  }),
  handler: async (args: unknown) => {
    const { query } = args as { query?: string };
    const client = await ensureLoggedIn();
    logger.info("Listing dumps", { query });
    const result = await client.dumps(query);
    return jsonResult(result);
  },
};

export const listFeeds: ToolDefinition = {
  name: "list_feeds",
  description: "List available ADT feeds. Feeds provide system activity streams like dumps, transport logs, and other events.",
  inputSchema: z.object({}),
  handler: async () => {
    const client = await ensureLoggedIn();
    logger.info("Listing feeds");
    const result = await client.feeds();
    return jsonResult(result);
  },
};

export const getObjectRevisions: ToolDefinition = {
  name: "get_object_revisions",
  description: "Get the version history of an ABAP object. Shows all revisions with date, author, and version number.",
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object name"),
    classInclude: z.enum(["definitions", "implementations", "macros", "testclasses", "main"]).optional()
      .describe("For classes: which include to get revisions for"),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName, classInclude } = args as {
      objectType: string; objectName: string; classInclude?: string;
    };
    const client = await ensureLoggedIn();
    const url = getObjectUrl(objectType, objectName);
    logger.info("Getting revisions", { url, classInclude });
    const result = await client.revisions(url, classInclude as any);
    return jsonResult(result);
  },
};

export const listInactiveObjects: ToolDefinition = {
  name: "list_inactive_objects",
  description: "List all inactive (not yet activated) ABAP objects. Useful to see pending changes that need activation.",
  inputSchema: z.object({}),
  handler: async () => {
    const client = await ensureLoggedIn();
    logger.info("Listing inactive objects");
    const result = await client.inactiveObjects();
    if (!result || result.length === 0) {
      return textResult("No inactive objects found.");
    }
    return jsonResult(result);
  },
};

export const getAbapDocumentation: ToolDefinition = {
  name: "get_abap_documentation",
  description: "Get ABAP documentation (F1 help) for a symbol at a specific position in source code. Returns HTML documentation.",
  inputSchema: z.object({
    objectUri: z.string().describe("ADT URI of the source object"),
    body: z.string().describe("Source code content"),
    line: z.number().describe("Line number of the symbol"),
    column: z.number().describe("Column of the symbol"),
    language: z.string().optional().describe("Language code (e.g. EN, DE). Defaults to EN."),
  }),
  handler: async (args: unknown) => {
    const { objectUri, body, line, column, language } = args as {
      objectUri: string; body: string; line: number; column: number; language?: string;
    };
    const client = await ensureLoggedIn();
    logger.info("Getting ABAP documentation", { objectUri, line, column });
    const result = await client.abapDocumentation(objectUri, body, line, column, language || "EN");
    return textResult(result);
  },
};

export const runClass: ToolDefinition = {
  name: "run_class",
  description: "Execute an ABAP class (if it implements IF_OO_ADT_CLASSRUN). Returns the console output. Useful for running test/utility classes.",
  inputSchema: z.object({
    className: z.string().describe("Class name to execute (e.g. ZCL_MY_RUNNER)"),
  }),
  handler: async (args: unknown) => {
    const { className } = args as { className: string };
    const client = await ensureLoggedIn();
    logger.info("Running class", { className });
    const result = await client.runClass(className);
    return textResult(result || "(No output)");
  },
};

export const runSqlQuery: ToolDefinition = {
  name: "run_sql_query",
  description: "Execute a SQL query on the SAP system. Supports JOINs, aggregations, WHERE clauses. More flexible than read_table_contents.",
  inputSchema: z.object({
    query: z.string().describe("SQL query to execute (e.g. SELECT * FROM sflight WHERE carrid = 'LH')"),
    rowNumber: z.number().optional().describe("Starting row number for pagination"),
  }),
  handler: async (args: unknown) => {
    const { query, rowNumber } = args as { query: string; rowNumber?: number };
    const client = await ensureLoggedIn();
    logger.info("Running SQL query", { query });
    const result = await client.runQuery(query, rowNumber);
    return jsonResult(result);
  },
};

export const systemTools: ToolDefinition[] = [
  listDumps,
  listFeeds,
  getObjectRevisions,
  listInactiveObjects,
  getAbapDocumentation,
  runClass,
  runSqlQuery,
];
