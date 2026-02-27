import { z } from "zod";
import { ensureLoggedIn } from "../adt-client.js";
import { getObjectUrl, getSourceUrl, CREATABLE_TYPES } from "../helpers/url-builder.js";
import { withLock } from "../helpers/lock-manager.js";
import { type ToolDefinition, ObjectTypeSchema, TransportSchema, textResult, jsonResult, errorResult } from "../../types/index.js";
import { logger } from "../logger.js";

export const createObject: ToolDefinition = {
  name: "create_object",
  description: `Create a new ABAP object (class, interface, CDS view, program, table, data element, service definition, service binding, package, etc.). The object is created but NOT activated — use activate_objects afterwards. Supported types: ${CREATABLE_TYPES.join(", ")}`,
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object name (e.g. ZCL_MY_CLASS). Must follow SAP naming conventions."),
    description: z.string().describe("Short description of the object"),
    packageName: z.string().describe("Target package (e.g. ZMY_PACKAGE, $TMP for local)"),
    transport: TransportSchema,
    serviceDefinition: z.string().optional().describe("Service definition name (required for SRVB/SVB)"),
    bindingVersion: z.enum(["V2", "V4"]).optional().describe("OData version for service binding (default V2)"),
    bindingCategory: z.enum(["0", "1"]).optional().describe("Service binding category: 0=Web API, 1=UI (default 0)"),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName, description, packageName, transport, serviceDefinition, bindingVersion, bindingCategory } = args as {
      objectType: string; objectName: string; description: string; packageName: string; transport?: string;
      serviceDefinition?: string; bindingVersion?: string; bindingCategory?: string;
    };
    const client = await ensureLoggedIn();
    logger.info("Creating object", { objectType, objectName, packageName });

    if (objectType === "SRVB/SVB") {
      // Service bindings need special handling with version/category support
      const srvDef = serviceDefinition || objectName;
      const version = bindingVersion || "V2";
      const category = bindingCategory || "0";
      const userName = (client as any).stateful?.username || "DEVELOPER";
      const body = `<?xml version="1.0" encoding="UTF-8"?>
        <srvb:serviceBinding xmlns:srvb="http://www.sap.com/adt/ddic/ServiceBindings"
          xmlns:adtcore="http://www.sap.com/adt/core"
          adtcore:description="${description}"
          adtcore:name="${objectName.toUpperCase()}" adtcore:type="SRVB/SVB"
          adtcore:responsible="${userName}">
          <adtcore:packageRef adtcore:name="${packageName.toUpperCase()}"/>
          <srvb:services srvb:name="${objectName.toUpperCase()}">
              <srvb:content srvb:version="0001">
                  <srvb:serviceDefinition adtcore:name="${srvDef.toUpperCase()}"/>
              </srvb:content>
          </srvb:services>
          <srvb:binding srvb:category="${category}" srvb:type="ODATA" srvb:version="${version}">
              <srvb:implementation adtcore:name=""/>
          </srvb:binding>
        </srvb:serviceBinding>`;
      const qs: any = {};
      if (transport) qs.corrNr = transport;
      await (client as any).httpClient.request(
        `/sap/bc/adt/businessservices/bindings`, {
          body,
          headers: { "Content-Type": "application/*" },
          method: "POST",
          qs,
        }
      );
    } else {
      const parentPath = `/sap/bc/adt/packages/${packageName.toLowerCase()}`;
      await client.createObject(
        objectType as any,
        objectName.toUpperCase(),
        packageName.toUpperCase(),
        description,
        parentPath,
        undefined, // responsible
        transport || ""
      );
    }

    return textResult(`Object created successfully: ${objectName} (${objectType}) in package ${packageName}.\nRemember to write source code and activate the object.`);
  },
};

export const writeObjectSource: ToolDefinition = {
  name: "write_object_source",
  description: "Write or update the source code of an ABAP object. Automatically handles lock/unlock. The object must exist first (use create_object). After writing, use activate_objects to activate.",
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object name"),
    source: z.string().describe("Complete source code to write"),
    transport: TransportSchema,
    sourceUrl: z.string().optional().describe("Direct ADT source URL if known"),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName, source, transport, sourceUrl } = args as {
      objectType: string; objectName: string; source: string; transport?: string; sourceUrl?: string;
    };
    const client = await ensureLoggedIn();
    const objUrl = getObjectUrl(objectType, objectName);
    const srcUrl = sourceUrl || getSourceUrl(objectType, objectName);

    logger.info("Writing object source", { objectType, objectName });

    await withLock(client, objUrl, async (lockHandle, lockTransport) => {
      const tr = transport || lockTransport || "";
      await client.setObjectSource(srcUrl, source, lockHandle, tr);
    });

    return textResult(`Source code written successfully for ${objectName}. Use activate_objects to activate it.`);
  },
};

export const deleteObject: ToolDefinition = {
  name: "delete_object",
  description: "Delete an ABAP object. Use with caution — this is irreversible. The object must not be locked by another user.",
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object name to delete"),
    transport: TransportSchema,
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName, transport } = args as {
      objectType: string; objectName: string; transport?: string;
    };
    const client = await ensureLoggedIn();
    const objUrl = getObjectUrl(objectType, objectName);

    logger.info("Deleting object", { objectType, objectName });

    await withLock(client, objUrl, async (lockHandle) => {
      await client.deleteObject(objUrl, lockHandle, transport);
    });

    return textResult(`Object ${objectName} (${objectType}) deleted successfully.`);
  },
};

export const activateObjects: ToolDefinition = {
  name: "activate_objects",
  description: "Activate one or more ABAP objects after creation or modification. Returns activation result with any errors or warnings. Activation compiles the object and makes it available for execution.",
  inputSchema: z.object({
    objectName: z.string().describe("Object name to activate"),
    objectUrl: z.string().optional().describe("ADT URL of the object (if known)"),
    objectType: ObjectTypeSchema.optional(),
  }),
  handler: async (args: unknown) => {
    const { objectName, objectUrl, objectType } = args as {
      objectName: string; objectUrl?: string; objectType?: string;
    };
    const client = await ensureLoggedIn();
    const url = objectUrl || (objectType ? getObjectUrl(objectType, objectName) : undefined);

    logger.info("Activating object", { objectName });

    const result = await client.activate(objectName, url || "");

    if (result.success) {
      return textResult(`Object ${objectName} activated successfully.`);
    }

    // Return errors so the LLM can iterate
    const messages = result.messages?.map((m: any) => ({
      type: m.type || m.severity,
      text: m.shortText || m.text || m.message,
      line: m.line,
      offset: m.offset,
    })) || [];

    return jsonResult({
      success: false,
      message: `Activation failed for ${objectName}. See errors below and fix them.`,
      errors: messages,
    });
  },
};

export const prettyPrint: ToolDefinition = {
  name: "pretty_print",
  description: "Format ABAP source code using SAP's Pretty Printer. Returns the formatted code.",
  inputSchema: z.object({
    source: z.string().describe("ABAP source code to format"),
  }),
  handler: async (args: unknown) => {
    const { source } = args as { source: string };
    const client = await ensureLoggedIn();
    const formatted = await client.prettyPrinter(source);
    return textResult(formatted);
  },
};

export const modificationTools: ToolDefinition[] = [
  createObject,
  writeObjectSource,
  deleteObject,
  activateObjects,
  prettyPrint,
];
