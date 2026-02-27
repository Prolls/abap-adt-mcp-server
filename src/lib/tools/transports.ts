import { z } from "zod";
import { ensureLoggedIn } from "../adt-client.js";
import { getObjectUrl } from "../helpers/url-builder.js";
import { type ToolDefinition, ObjectTypeSchema, textResult, jsonResult, errorResult } from "../../types/index.js";
import { logger } from "../logger.js";

export const listTransports: ToolDefinition = {
  name: "list_transports",
  description: "List transport requests for the current user. Shows workbench and customizing transports with their status and tasks.",
  inputSchema: z.object({
    user: z.string().optional().describe("User name (defaults to connected user)"),
  }),
  handler: async (args: unknown) => {
    const { user } = args as { user?: string };
    const client = await ensureLoggedIn();
    const userName = user || client.username;
    const transports = await client.userTransports(userName);
    return jsonResult(transports);
  },
};

export const createTransport: ToolDefinition = {
  name: "create_transport",
  description: "Create a new transport request for a given package. Returns the transport number. Use get_transport_info first to find the correct transportLayer and CTS project for the target package.",
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object name"),
    description: z.string().describe("Transport description"),
    packageName: z.string().describe("Package name"),
    transportLayer: z.string().optional().describe("Transport layer (e.g. ZDS7). Get from get_transport_info PDEVCLASS field."),
    ctsProject: z.string().optional().describe("CTS project external ID (e.g. SUPPORT). Required when CTS project enforcement is active. Get from get_transport_info CTS_PROJECTS."),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName, description, packageName, transportLayer, ctsProject } = args as {
      objectType: string; objectName: string; description: string; packageName: string;
      transportLayer?: string; ctsProject?: string;
    };
    const client = await ensureLoggedIn();
    const objUrl = getObjectUrl(objectType, objectName);

    logger.info("Creating transport", { description, packageName, transportLayer, ctsProject });

    if (ctsProject) {
      // When CTS project is specified, use the transportrequests endpoint
      // with tm:root XML format and tm:cts_project attribute
      const trInfoResult = await client.transportInfo(objUrl, packageName);
      const ctsProjects = (trInfoResult as any).CTS_PROJECTS?.SADT_CTS_PROJECT || [];
      const project = ctsProjects.find((p: any) => p.EXTERNALID === ctsProject);

      if (!project) {
        return errorResult(`CTS project "${ctsProject}" not found. Available: ${ctsProjects.map((p: any) => p.EXTERNALID).join(", ")}`);
      }

      // Get transport target from existing transports or use default
      const existingTransports = (trInfoResult as any).TRANSPORTS || [];
      const target = existingTransports[0]?.TARSYSTEM || "/ZDEV/";

      const bodyXml = [
        `<?xml version="1.0" encoding="ASCII"?>`,
        `<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:useraction="newrequest">`,
        `<tm:request tm:desc="${description}" tm:type="K" tm:target="${target}"`,
        ` tm:cts_project="${project.TRKORR}" tm:owner="${client.username}">`,
        `<tm:task tm:owner="${client.username}"/>`,
        `</tm:request></tm:root>`,
      ].join("");

      const response = await client.httpClient.request("/sap/bc/adt/cts/transportrequests", {
        body: bodyXml,
        headers: {
          Accept: "application/*",
          "Content-Type": "text/plain",
        },
        method: "POST",
      });

      // Extract transport number from response XML (tm:number attribute)
      const numberMatch = response.body?.match(/tm:number="([^"]+)"/);
      const transport = numberMatch ? numberMatch[1] : "";

      return textResult(`Transport created: ${transport} (CTS project: ${ctsProject})`);
    } else {
      const transport = await client.createTransport(objUrl, description, packageName, transportLayer);
      return textResult(`Transport created: ${transport}`);
    }
  },
};

export const getTransportInfo: ToolDefinition = {
  name: "get_transport_info",
  description: "Get transport information for an ABAP object: which transport is needed, whether the object is locked in a transport, etc.",
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object name"),
    packageName: z.string().optional().describe("Package name"),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName, packageName } = args as {
      objectType: string; objectName: string; packageName?: string;
    };
    const client = await ensureLoggedIn();
    const objUrl = getObjectUrl(objectType, objectName);
    const info = await client.transportInfo(objUrl, packageName);
    return jsonResult(info);
  },
};

export const releaseTransport: ToolDefinition = {
  name: "release_transport",
  description: "Release a transport request. Once released, the transport can be imported into other systems.",
  inputSchema: z.object({
    transportNumber: z.string().describe("Transport number (e.g. NPLK900001)"),
  }),
  handler: async (args: unknown) => {
    const { transportNumber } = args as { transportNumber: string };
    const client = await ensureLoggedIn();
    logger.info("Releasing transport", { transportNumber });
    await client.transportRelease(transportNumber);
    return textResult(`Transport ${transportNumber} released successfully.`);
  },
};

export const transportTools: ToolDefinition[] = [
  listTransports,
  createTransport,
  getTransportInfo,
  releaseTransport,
];
