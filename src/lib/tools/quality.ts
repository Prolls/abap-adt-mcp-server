import { z } from "zod";
import { ensureLoggedIn } from "../adt-client.js";
import { getSourceUrl, getObjectUrl } from "../helpers/url-builder.js";
import { type ToolDefinition, ObjectTypeSchema, textResult, jsonResult } from "../../types/index.js";
import { logger } from "../logger.js";

export const syntaxCheck: ToolDefinition = {
  name: "syntax_check",
  description: "Check ABAP source code for syntax errors. Returns a list of errors and warnings with line numbers. Use this after writing source code and before activating.",
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object name"),
    source: z.string().describe("Source code to check"),
    sourceUrl: z.string().optional().describe("Direct source URL if known"),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName, source, sourceUrl } = args as {
      objectType: string; objectName: string; source: string; sourceUrl?: string;
    };
    const client = await ensureLoggedIn();
    const srcUrl = sourceUrl || getSourceUrl(objectType, objectName);

    logger.info("Running syntax check", { objectName });
    const results = await client.syntaxCheck(srcUrl, srcUrl, source);

    if (!results || results.length === 0) {
      return textResult(`Syntax check passed for ${objectName}. No errors found.`);
    }

    const findings = results.map((r: any) => ({
      severity: r.severity,
      line: r.line,
      offset: r.offset,
      text: r.text,
    }));

    return jsonResult({
      objectName,
      passed: findings.every((f: any) => f.severity !== "E" && f.severity !== "error"),
      findings,
    });
  },
};

export const runUnitTests: ToolDefinition = {
  name: "run_unit_tests",
  description: "Execute ABAP Unit (AUnit) tests for a class or program. Returns test results with pass/fail status, assertions, and error details. Essential for iterating on code quality.",
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object name containing tests (e.g. ZCL_MY_CLASS)"),
    includeHarmless: z.boolean().optional().default(true).describe("Run harmless tests (default true)"),
    includeDangerous: z.boolean().optional().default(false).describe("Run dangerous tests (default false)"),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName, includeHarmless, includeDangerous } = args as {
      objectType: string; objectName: string; includeHarmless: boolean; includeDangerous: boolean;
    };
    const client = await ensureLoggedIn();
    const url = getSourceUrl(objectType, objectName);

    logger.info("Running unit tests", { objectName });
    const results = await client.unitTestRun(url, {
      harmless: includeHarmless,
      dangerous: includeDangerous,
      critical: false,
      short: true,
      medium: true,
      long: false,
    });

    if (!results || results.length === 0) {
      return textResult(`No unit tests found in ${objectName}.`);
    }

    // Summarize results
    let totalTests = 0;
    let passed = 0;
    let failed = 0;
    const details: any[] = [];

    for (const testClass of results) {
      for (const method of (testClass as any).testmethods || []) {
        totalTests++;
        if (method.alerts && method.alerts.length > 0) {
          failed++;
          details.push({
            class: (testClass as any).name,
            method: method.name,
            status: "FAILED",
            alerts: method.alerts.map((a: any) => ({
              severity: a.severity,
              text: a.text || a.title,
              details: a.details,
            })),
          });
        } else {
          passed++;
          details.push({
            class: (testClass as any).name,
            method: method.name,
            status: "PASSED",
          });
        }
      }
    }

    return jsonResult({
      objectName,
      summary: { total: totalTests, passed, failed },
      allPassed: failed === 0,
      details,
    });
  },
};

export const runAtcChecks: ToolDefinition = {
  name: "run_atc_checks",
  description: "Run ABAP Test Cockpit (ATC) checks on an object. ATC provides deeper static analysis than syntax check: security issues, performance, naming conventions, etc.",
  inputSchema: z.object({
    objectType: ObjectTypeSchema,
    objectName: z.string().describe("Object name to check"),
  }),
  handler: async (args: unknown) => {
    const { objectType, objectName } = args as { objectType: string; objectName: string };
    const client = await ensureLoggedIn();
    const url = getObjectUrl(objectType, objectName);

    logger.info("Running ATC checks", { objectName });
    const runResult = await client.createAtcRun("DEFAULT", url);
    const worklist = await client.atcWorklists(runResult.id);

    return jsonResult({ objectName, runId: runResult.id, results: worklist });
  },
};

export const qualityTools: ToolDefinition[] = [
  syntaxCheck,
  runUnitTests,
  runAtcChecks,
];
