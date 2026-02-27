import { z } from "zod";
import { ensureLoggedIn } from "../adt-client.js";
import { getObjectUrl, getSourceUrl } from "../helpers/url-builder.js";
import { type ToolDefinition, ObjectTypeSchema, textResult, jsonResult, errorResult } from "../../types/index.js";
import { logger } from "../logger.js";

export const searchObjects: ToolDefinition = {
  name: "search_objects",
  description: "Search for ABAP objects by name pattern and optional type. Returns matching object names, types, and URLs. Use wildcards like ZCL_* or *SALES*.",
  inputSchema: z.object({
    query: z.string().describe("Search query with optional wildcards (e.g. ZCL_*, *SALES*, Z_CDS*)"),
    objectType: z.string().optional().describe("Filter by object type (e.g. CLAS/OC, DDLS/DF, INTF/OI)"),
    maxResults: z.number().optional().default(50).describe("Maximum number of results (default 50)"),
  }),
  handler: async (args: unknown) => {
    const { query, objectType, maxResults } = args as { query: string; objectType?: string; maxResults: number };
    const client = await ensureLoggedIn();
    const results = await client.searchObject(query, objectType, maxResults);
    if (results.length === 0) {
      return textResult(`No objects found matching "${query}"`);
    }
    return jsonResult(results);
  },
};

export const listPackageContents: ToolDefinition = {
  name: "list_package_contents",
  description: "List all objects in an ABAP package (development class). Shows classes, CDS views, interfaces, programs, etc. contained in the package.",
  inputSchema: z.object({
    packageName: z.string().describe("Package name (e.g. ZMY_PACKAGE, $TMP)"),
  }),
  handler: async (args: unknown) => {
    const { packageName } = args as { packageName: string };
    const client = await ensureLoggedIn();
    const structure = await client.nodeContents("DEVC/K", packageName);
    const nodes = structure.nodes.map((n: any) => ({
      name: n.OBJECT_NAME,
      type: n.OBJECT_TYPE,
      description: n.DESCRIPTION || "",
      uri: n.OBJECT_URI || "",
    }));
    if (nodes.length === 0) {
      return textResult(`Package "${packageName}" is empty or does not exist.`);
    }
    return jsonResult({ packageName, objectCount: nodes.length, objects: nodes });
  },
};

export const readObjectSource: ToolDefinition = {
  name: "read_object_source",
  description: "Read the source code of an ABAP object (class, CDS view, interface, program, etc.). Returns the full source code as text.",
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object name (e.g. ZCL_MY_CLASS, Z_MY_CDS_VIEW)"),
    sourceUrl: z.string().optional().describe("Direct ADT source URL if known (overrides type/name resolution)"),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName, sourceUrl } = args as { objectType: string; objectName: string; sourceUrl?: string };
    const client = await ensureLoggedIn();
    const url = sourceUrl || getSourceUrl(objectType, objectName);
    logger.debug("Reading source", { url });
    const source = await client.getObjectSource(url);
    if (!source || source.trim().length === 0) {
      return textResult(`Object "${objectName}" has no source code or does not exist.`);
    }
    return textResult(source);
  },
};

export const getObjectStructure: ToolDefinition = {
  name: "get_object_structure",
  description: "Get the structure of an ABAP object: its includes (for classes: definition, implementation, test classes, macros), sub-objects, etc.",
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object name"),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName } = args as { objectType: string; objectName: string };
    const client = await ensureLoggedIn();
    const url = getObjectUrl(objectType, objectName);
    const structure = await client.objectStructure(url);
    return jsonResult(structure);
  },
};

export const getClassComponents: ToolDefinition = {
  name: "get_class_components",
  description: "List all components of a class or interface: methods, attributes, types, constants, events, with their visibility and signatures.",
  inputSchema: z.object({
    objectName: z.string().describe("Class or interface name (e.g. ZCL_MY_CLASS)"),
  }),
  handler: async (args: unknown) => {
    const { objectName } = args as { objectName: string };
    const client = await ensureLoggedIn();
    const url = `/sap/bc/adt/oo/classes/${objectName.toLowerCase()}`;
    const components = await client.classComponents(url);
    return jsonResult(components);
  },
};

export const getTypeHierarchy: ToolDefinition = {
  name: "get_type_hierarchy",
  description: "Get the inheritance hierarchy of a class: super classes and sub classes.",
  inputSchema: z.object({
    objectName: z.string().describe("Class name"),
    source: z.string().describe("Source code of the class"),
    line: z.number().describe("Line number of the class name in source"),
    offset: z.number().describe("Column offset of the class name"),
  }),
  handler: async (args: unknown) => {
    const { objectName, source, line, offset } = args as {
      objectName: string; source: string; line: number; offset: number;
    };
    const client = await ensureLoggedIn();
    const url = `/sap/bc/adt/oo/classes/${objectName.toLowerCase()}`;
    const hierarchy = await client.typeHierarchy(url, source, line, offset);
    return jsonResult(hierarchy);
  },
};

export const findReferences: ToolDefinition = {
  name: "find_references",
  description: "Find all references (where-used list) for an ABAP object. Shows all places in the system that reference this object.",
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object name"),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName } = args as { objectType: string; objectName: string };
    const client = await ensureLoggedIn();
    const url = getObjectUrl(objectType, objectName);
    const refs = await client.usageReferences(url);
    if (!refs || (Array.isArray(refs) && refs.length === 0)) {
      return textResult(`No references found for "${objectName}".`);
    }
    return jsonResult(refs);
  },
};

export const findDefinition: ToolDefinition = {
  name: "find_definition",
  description: "Navigate to the definition of a symbol used in source code. Provide the source URL, source code, and position of the symbol.",
  inputSchema: z.object({
    sourceUrl: z.string().describe("ADT URL of the source containing the symbol"),
    source: z.string().describe("Full source code text"),
    line: z.number().describe("Line number of the symbol (0-based)"),
    startCol: z.number().describe("Start column of the symbol (0-based)"),
    endCol: z.number().describe("End column of the symbol (0-based)"),
  }),
  handler: async (args: unknown) => {
    const { sourceUrl, source, line, startCol, endCol } = args as {
      sourceUrl: string; source: string; line: number; startCol: number; endCol: number;
    };
    const client = await ensureLoggedIn();
    const definition = await client.findDefinition(sourceUrl, source, line, startCol, endCol);
    return jsonResult(definition);
  },
};

export const explorationTools: ToolDefinition[] = [
  searchObjects,
  listPackageContents,
  readObjectSource,
  getObjectStructure,
  getClassComponents,
  getTypeHierarchy,
  findReferences,
  findDefinition,
];
