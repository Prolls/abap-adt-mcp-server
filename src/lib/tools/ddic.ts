import { z } from "zod";
import { ensureLoggedIn } from "../adt-client.js";
import { type ToolDefinition, textResult, jsonResult } from "../../types/index.js";
import { logger } from "../logger.js";

export const getDdicElement: ToolDefinition = {
  name: "get_ddic_element",
  description: "Get DDIC element metadata: field types, lengths, labels, keys, and annotations. Works with tables, CDS views, structures, and data elements.",
  inputSchema: z.object({
    path: z.union([z.string(), z.array(z.string())])
      .describe("DDIC path — table/view name as string, or array for nested access (e.g. ['SFLIGHT', 'CARRID'])"),
    getTargetForAssociation: z.boolean().optional().describe("Include association targets"),
    getExtensionViews: z.boolean().optional().describe("Include extension views"),
    getSecondaryObjects: z.boolean().optional().describe("Include secondary objects"),
  }),
  handler: async (args: unknown) => {
    const { path, getTargetForAssociation, getExtensionViews, getSecondaryObjects } = args as {
      path: string | string[];
      getTargetForAssociation?: boolean;
      getExtensionViews?: boolean;
      getSecondaryObjects?: boolean;
    };
    const client = await ensureLoggedIn();
    logger.info("Getting DDIC element", { path });
    const result = await client.ddicElement(path, getTargetForAssociation, getExtensionViews, getSecondaryObjects);
    return jsonResult(result);
  },
};

export const getDdicRepoAccess: ToolDefinition = {
  name: "get_ddic_repo_access",
  description: "Get DDIC repository access information for an element. Returns object references with URIs, types, and names.",
  inputSchema: z.object({
    path: z.union([z.string(), z.array(z.string())])
      .describe("DDIC path — table/view name as string, or array for nested access"),
  }),
  handler: async (args: unknown) => {
    const { path } = args as { path: string | string[] };
    const client = await ensureLoggedIn();
    logger.info("Getting DDIC repository access", { path });
    const result = await client.ddicRepositoryAccess(path);
    return jsonResult(result);
  },
};

export const getAnnotationDefinitions: ToolDefinition = {
  name: "get_annotation_definitions",
  description: "Get all available CDS annotation definitions. Returns the full list of annotations that can be used in CDS views.",
  inputSchema: z.object({}),
  handler: async () => {
    const client = await ensureLoggedIn();
    logger.info("Getting annotation definitions");
    const result = await client.annotationDefinitions();
    return textResult(result);
  },
};

export const ddicTools: ToolDefinition[] = [
  getDdicElement,
  getDdicRepoAccess,
  getAnnotationDefinitions,
];
