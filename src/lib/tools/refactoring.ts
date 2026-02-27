import { z } from "zod";
import { ensureLoggedIn } from "../adt-client.js";
import { getObjectUrl, getSourceUrl } from "../helpers/url-builder.js";
import { type ToolDefinition, ObjectTypeSchema, textResult, jsonResult } from "../../types/index.js";
import { logger } from "../logger.js";

export const renameSymbol: ToolDefinition = {
  name: "rename_symbol",
  description: "Rename a symbol (variable, method, class, etc.) across the entire codebase. Provide the position of the symbol in the source.",
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object containing the symbol"),
    line: z.number().describe("Line number of the symbol (0-based)"),
    startColumn: z.number().describe("Start column of the symbol (0-based)"),
    endColumn: z.number().describe("End column of the symbol (0-based)"),
    transport: z.string().optional().describe("Transport request number"),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName, line, startColumn, endColumn, transport } = args as {
      objectType: string; objectName: string; line: number; startColumn: number; endColumn: number; transport?: string;
    };
    const client = await ensureLoggedIn();
    const url = getObjectUrl(objectType, objectName);

    logger.info("Evaluating rename", { objectName });
    const proposal = await client.renameEvaluate(url, line, startColumn, endColumn);

    // Return the proposal for the LLM to review and decide on the new name
    return jsonResult({
      message: "Rename proposal evaluated. Use the returned proposal to execute the rename with renamePreview and renameExecute.",
      proposal,
    });
  },
};

export const extractMethod: ToolDefinition = {
  name: "extract_method",
  description: "Extract a block of code into a new method. Provide the source URL and the range of code to extract.",
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object containing the code"),
    startLine: z.number().describe("Start line of the code block (0-based)"),
    startColumn: z.number().describe("Start column (0-based)"),
    endLine: z.number().describe("End line of the code block (0-based)"),
    endColumn: z.number().describe("End column (0-based)"),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName, startLine, startColumn, endLine, endColumn } = args as {
      objectType: string; objectName: string; startLine: number; startColumn: number; endLine: number; endColumn: number;
    };
    const client = await ensureLoggedIn();
    const url = getObjectUrl(objectType, objectName);

    logger.info("Evaluating method extraction", { objectName });
    const range = { start: { line: startLine, column: startColumn }, end: { line: endLine, column: endColumn } };
    const proposal = await client.extractMethodEvaluate(url, range);
    const refactoring = await client.extractMethodPreview(proposal);
    const result = await client.extractMethodExecute(refactoring);

    return textResult("Method extracted successfully.");
  },
};

export const codeCompletion: ToolDefinition = {
  name: "code_completion",
  description: "Get code completion suggestions at a specific position in ABAP source code. Useful for discovering available methods, types, and keywords.",
  inputSchema: z.object({
    sourceUrl: z.string().describe("ADT URL of the source"),
    source: z.string().describe("Current source code"),
    line: z.number().describe("Cursor line (0-based)"),
    column: z.number().describe("Cursor column (0-based)"),
  }),
  handler: async (args: unknown) => {
    const { sourceUrl, source, line, column } = args as {
      sourceUrl: string; source: string; line: number; column: number;
    };
    const client = await ensureLoggedIn();
    const proposals = await client.codeCompletion(sourceUrl, source, line, column);
    if (!proposals || proposals.length === 0) {
      return textResult("No completion suggestions available at this position.");
    }
    return jsonResult(proposals);
  },
};

export const getFixProposals: ToolDefinition = {
  name: "get_fix_proposals",
  description: "Get quick-fix proposals for a syntax error at a given position. Returns suggested code corrections.",
  inputSchema: z.object({
    sourceUrl: z.string().describe("ADT URL of the source"),
    source: z.string().describe("Full source code"),
    line: z.number().describe("Line number of the error"),
    column: z.number().describe("Column of the error"),
  }),
  handler: async (args: unknown) => {
    const { sourceUrl, source, line, column } = args as {
      sourceUrl: string; source: string; line: number; column: number;
    };
    const client = await ensureLoggedIn();
    const proposals = await client.fixProposals(sourceUrl, source, line, column);
    if (!proposals || proposals.length === 0) {
      return textResult("No fix proposals available.");
    }
    return jsonResult(proposals);
  },
};

export const refactoringTools: ToolDefinition[] = [
  renameSymbol,
  extractMethod,
  codeCompletion,
  getFixProposals,
];
