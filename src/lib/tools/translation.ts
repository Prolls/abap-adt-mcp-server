import { z } from "zod";
import { ensureLoggedIn } from "../adt-client.js";
import { getObjectUrl, getSourceUrl } from "../helpers/url-builder.js";
import { type ToolDefinition, ObjectTypeSchema, textResult, jsonResult, errorResult } from "../../types/index.js";
import { logger } from "../logger.js";

// Helper: read object source in a specific language by injecting sap-language query param
async function readSourceInLanguage(objectUrl: string, language: string): Promise<string> {
  const client = await ensureLoggedIn();
  const response = await client.httpClient.request(objectUrl, {
    method: "GET",
    headers: { Accept: "text/plain, application/*" },
    qs: { "sap-language": language.toUpperCase() },
  });
  return response.body || "";
}

// Helper: read object structure in a specific language
async function readStructureInLanguage(objectUrl: string, language: string): Promise<string> {
  const client = await ensureLoggedIn();
  const response = await client.httpClient.request(objectUrl, {
    method: "GET",
    headers: { Accept: "application/xml" },
    qs: { "sap-language": language.toUpperCase() },
  });
  return response.body || "";
}

// Helper: parse simple XML attributes and text from a message class source
function parseMessageClassXml(xml: string): Array<{ number: string; shortText: string }> {
  const messages: Array<{ number: string; shortText: string }> = [];
  // Match <mc:message> elements with msgnumber and shortText attributes
  const msgRegex = /<mc:message[^>]*msgnumber="(\d{3})"[^>]*shortText="([^"]*)"[^>]*\/?>/g;
  let match;
  while ((match = msgRegex.exec(xml)) !== null) {
    messages.push({ number: match[1], shortText: match[2] });
  }
  return messages;
}

// Helper: parse data element labels from XML source
function parseDataElementLabels(xml: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const patterns: Array<[string, RegExp]> = [
    ["shortText", /ddic:ShortDescription[^>]*>([^<]*)</],
    ["mediumText", /ddic:MediumDescription[^>]*>([^<]*)</],
    ["longText", /ddic:LongDescription[^>]*>([^<]*)</],
    ["heading", /ddic:HeadingDescription[^>]*>([^<]*)</],
    // Alternative attribute-based format
    ["shortText", /shortDescription="([^"]*)"/],
    ["mediumText", /mediumDescription="([^"]*)"/],
    ["longText", /longDescription="([^"]*)"/],
    ["heading", /headingDescription="([^"]*)"/],
  ];
  for (const [key, regex] of patterns) {
    const m = xml.match(regex);
    if (m && m[1] && !labels[key]) {
      labels[key] = m[1];
    }
  }
  return labels;
}

export const getObjectTextsInLanguage: ToolDefinition = {
  name: "get_object_texts_in_language",
  description: "Read the source/content of an ABAP object in a specific language. Useful for seeing translations of texts, labels, and descriptions. Returns the raw source as seen in the target language.",
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object name"),
    language: z.string().describe("Target language code (e.g. EN, DE, FR, ES, PT, JA, ZH)"),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName, language } = args as {
      objectType: string; objectName: string; language: string;
    };
    logger.info("Reading object texts in language", { objectType, objectName, language });
    const sourceUrl = getSourceUrl(objectType, objectName);
    const source = await readSourceInLanguage(sourceUrl, language);
    if (!source || source.trim().length === 0) {
      return textResult(`No source found for "${objectName}" in language ${language}.`);
    }
    return textResult(source);
  },
};

export const getDataElementLabels: ToolDefinition = {
  name: "get_data_element_labels",
  description: "Get the labels (short, medium, long, heading) of a data element in a specific language. Useful for translation workflows.",
  inputSchema: z.object({
    dataElementName: z.string().describe("Data element name (e.g. MANDT, BUKRS)"),
    language: z.string().describe("Language code (e.g. EN, DE, FR)"),
  }),
  handler: async (args: unknown) => {
    const { dataElementName, language } = args as { dataElementName: string; language: string };
    const client = await ensureLoggedIn();
    logger.info("Getting data element labels", { dataElementName, language });
    const url = `/sap/bc/adt/ddic/dataelements/${dataElementName.toLowerCase()}`;
    const xml = await readStructureInLanguage(url, language);
    const labels = parseDataElementLabels(xml);
    return jsonResult({
      dataElement: dataElementName,
      language: language.toUpperCase(),
      labels,
      rawXml: xml,
    });
  },
};

export const getMessageClassTexts: ToolDefinition = {
  name: "get_message_class_texts",
  description: "Get all message texts of a message class in a specific language. Returns message numbers and their texts.",
  inputSchema: z.object({
    messageClass: z.string().describe("Message class name (e.g. ZMSG_MYAPP)"),
    language: z.string().describe("Language code (e.g. EN, DE, FR)"),
  }),
  handler: async (args: unknown) => {
    const { messageClass, language } = args as { messageClass: string; language: string };
    logger.info("Getting message class texts", { messageClass, language });
    const url = `/sap/bc/adt/messageclass/${messageClass.toLowerCase()}/source/main`;
    const xml = await readSourceInLanguage(url, language);
    const messages = parseMessageClassXml(xml);
    return jsonResult({
      messageClass,
      language: language.toUpperCase(),
      messageCount: messages.length,
      messages,
      rawSource: xml,
    });
  },
};

export const writeMessageClassTexts: ToolDefinition = {
  name: "write_message_class_texts",
  description: "Write/update message texts in a message class. Provide the full XML source with updated texts. Use get_message_class_texts first to get the current source, modify the texts, then write back.",
  inputSchema: z.object({
    messageClass: z.string().describe("Message class name"),
    source: z.string().describe("Full XML source of the message class with updated texts"),
    transport: z.string().optional().describe("Transport request number (required for non-$TMP packages)"),
    language: z.string().optional().describe("Target language code (defaults to system language)"),
  }),
  handler: async (args: unknown) => {
    const { messageClass, source, transport, language } = args as {
      messageClass: string; source: string; transport?: string; language?: string;
    };
    const client = await ensureLoggedIn();
    logger.info("Writing message class texts", { messageClass, language });
    const url = `/sap/bc/adt/messageclass/${messageClass.toLowerCase()}`;

    // Lock the object
    const lockResponse = await client.httpClient.request(`${url}`, {
      method: "POST",
      headers: { "X-sap-adt-sessiontype": "stateful" },
      qs: { _action: "LOCK", accessMode: "MODIFY" },
    });
    const lockHandle = lockResponse.body?.match(/lockHandle="([^"]*)"/)?.[1]
      || lockResponse.headers?.["x-sap-adt-lockhandle"] as string;

    if (!lockHandle) {
      return errorResult("Failed to acquire lock on message class.");
    }

    try {
      const writeQs: Record<string, string> = { lockHandle };
      if (transport) writeQs.corrNr = transport;
      if (language) writeQs["sap-language"] = language.toUpperCase();

      await client.httpClient.request(`${url}/source/main`, {
        method: "PUT",
        headers: { "Content-Type": "application/*" },
        body: source,
        qs: writeQs,
      });

      return textResult(`Message class ${messageClass} texts updated successfully.`);
    } finally {
      // Unlock
      await client.httpClient.request(`${url}`, {
        method: "POST",
        qs: { _action: "UNLOCK", lockHandle },
      }).catch(() => {});
    }
  },
};

export const writeDataElementLabels: ToolDefinition = {
  name: "write_data_element_labels",
  description: "Write/update data element labels (short, medium, long, heading) in a specific language. Use get_data_element_labels first to get the current XML source, modify the labels, then write back the full XML.",
  inputSchema: z.object({
    dataElementName: z.string().describe("Data element name"),
    source: z.string().describe("Full XML source of the data element with updated labels"),
    transport: z.string().optional().describe("Transport request number (required for non-$TMP packages)"),
    language: z.string().optional().describe("Target language code"),
  }),
  handler: async (args: unknown) => {
    const { dataElementName, source, transport, language } = args as {
      dataElementName: string; source: string; transport?: string; language?: string;
    };
    const client = await ensureLoggedIn();
    logger.info("Writing data element labels", { dataElementName, language });
    const url = `/sap/bc/adt/ddic/dataelements/${dataElementName.toLowerCase()}`;

    // Lock
    const lockResponse = await client.httpClient.request(url, {
      method: "POST",
      headers: { "X-sap-adt-sessiontype": "stateful" },
      qs: { _action: "LOCK", accessMode: "MODIFY" },
    });
    const lockHandle = lockResponse.body?.match(/lockHandle="([^"]*)"/)?.[1]
      || lockResponse.headers?.["x-sap-adt-lockhandle"] as string;

    if (!lockHandle) {
      return errorResult("Failed to acquire lock on data element.");
    }

    try {
      const writeQs: Record<string, string> = { lockHandle };
      if (transport) writeQs.corrNr = transport;
      if (language) writeQs["sap-language"] = language.toUpperCase();

      await client.httpClient.request(`${url}/source/main`, {
        method: "PUT",
        headers: { "Content-Type": "application/*" },
        body: source,
        qs: writeQs,
      });

      return textResult(`Data element ${dataElementName} labels updated successfully.`);
    } finally {
      await client.httpClient.request(url, {
        method: "POST",
        qs: { _action: "UNLOCK", lockHandle },
      }).catch(() => {});
    }
  },
};

export const getTextPoolInLanguage: ToolDefinition = {
  name: "get_text_pool_in_language",
  description: "Get text elements (text pool / text symbols) of an ABAP program or class in a specific language. These are the TEXT-xxx symbols used in programs.",
  inputSchema: z.object({
    programName: z.string().describe("Program or class name"),
    language: z.string().describe("Language code (e.g. EN, DE, FR)"),
  }),
  handler: async (args: unknown) => {
    const { programName, language } = args as { programName: string; language: string };
    const client = await ensureLoggedIn();
    logger.info("Getting text pool", { programName, language });

    // Try program text elements endpoint
    const url = `/sap/bc/adt/programs/programs/${programName.toLowerCase()}/textelements`;
    try {
      const response = await client.httpClient.request(url, {
        method: "GET",
        headers: { Accept: "application/xml, application/json" },
        qs: { "sap-language": language.toUpperCase() },
      });
      return textResult(response.body || "No text elements found.");
    } catch {
      // Fallback: try reading from SQL
      logger.info("Text elements endpoint not available, trying SQL fallback");
      try {
        const query = `SELECT * FROM textpool WHERE progname = '${programName.toUpperCase()}' AND sprsl = '${language.toUpperCase()}'`;
        const result = await client.runQuery(query);
        return jsonResult({ programName, language: language.toUpperCase(), textElements: result });
      } catch {
        return errorResult(
          `Could not retrieve text elements for ${programName}. ` +
          `The text elements endpoint may not be available on this system.`
        );
      }
    }
  },
};

export const compareObjectLanguages: ToolDefinition = {
  name: "compare_object_languages",
  description: "Compare an object's texts between two languages side by side. Useful to identify missing translations. Works with message classes and data elements.",
  inputSchema: z.object({
    objectType: z.enum(["MSAG/N", "DTEL/DE"]).describe("Object type: MSAG/N for message class, DTEL/DE for data element"),
    objectName: z.string().describe("Object name"),
    sourceLanguage: z.string().describe("Source language code (e.g. EN)"),
    targetLanguage: z.string().describe("Target language code (e.g. FR)"),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName, sourceLanguage, targetLanguage } = args as {
      objectType: string; objectName: string; sourceLanguage: string; targetLanguage: string;
    };
    logger.info("Comparing object languages", { objectType, objectName, sourceLanguage, targetLanguage });

    if (objectType === "MSAG/N") {
      const srcUrl = `/sap/bc/adt/messageclass/${objectName.toLowerCase()}/source/main`;
      const [srcXml, tgtXml] = await Promise.all([
        readSourceInLanguage(srcUrl, sourceLanguage),
        readSourceInLanguage(srcUrl, targetLanguage),
      ]);
      const srcMsgs = parseMessageClassXml(srcXml);
      const tgtMsgs = parseMessageClassXml(tgtXml);
      const tgtMap = new Map(tgtMsgs.map(m => [m.number, m.shortText]));

      const comparison = srcMsgs.map(m => ({
        number: m.number,
        [sourceLanguage.toUpperCase()]: m.shortText,
        [targetLanguage.toUpperCase()]: tgtMap.get(m.number) || "(missing)",
        translated: !!tgtMap.get(m.number),
      }));

      const translatedCount = comparison.filter(c => c.translated).length;
      return jsonResult({
        objectType,
        objectName,
        sourceLanguage: sourceLanguage.toUpperCase(),
        targetLanguage: targetLanguage.toUpperCase(),
        totalMessages: comparison.length,
        translatedCount,
        missingCount: comparison.length - translatedCount,
        messages: comparison,
      });
    }

    if (objectType === "DTEL/DE") {
      const url = `/sap/bc/adt/ddic/dataelements/${objectName.toLowerCase()}`;
      const [srcXml, tgtXml] = await Promise.all([
        readStructureInLanguage(url, sourceLanguage),
        readStructureInLanguage(url, targetLanguage),
      ]);
      const srcLabels = parseDataElementLabels(srcXml);
      const tgtLabels = parseDataElementLabels(tgtXml);

      const comparison: Record<string, { source: string; target: string; translated: boolean }> = {};
      for (const key of Object.keys(srcLabels)) {
        comparison[key] = {
          source: srcLabels[key] || "",
          target: tgtLabels[key] || "(missing)",
          translated: !!tgtLabels[key],
        };
      }

      return jsonResult({
        objectType,
        objectName,
        sourceLanguage: sourceLanguage.toUpperCase(),
        targetLanguage: targetLanguage.toUpperCase(),
        labels: comparison,
      });
    }

    return errorResult(`Unsupported object type for comparison: ${objectType}`);
  },
};

export const translationTools: ToolDefinition[] = [
  getObjectTextsInLanguage,
  getDataElementLabels,
  getMessageClassTexts,
  writeMessageClassTexts,
  writeDataElementLabels,
  getTextPoolInLanguage,
  compareObjectLanguages,
];
