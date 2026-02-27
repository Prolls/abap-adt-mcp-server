import { z } from "zod";
import { ensureLoggedIn } from "../adt-client.js";
import { type ToolDefinition, textResult, jsonResult, errorResult } from "../../types/index.js";
import { logger } from "../logger.js";

const GCTS_BASE = "/sap/bc/cts_abapvcs";

async function gctsRequest(method: string, path: string, body?: unknown) {
  const client = await ensureLoggedIn();
  const headers: Record<string, string> = { Accept: "application/json" };
  const options: Record<string, unknown> = { method, headers };
  if (body) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await client.httpClient.request(`${GCTS_BASE}${path}`, options);
  if (!response.body) return {};
  try {
    return JSON.parse(response.body);
  } catch {
    return { raw: response.body };
  }
}

export const gctsListRepositories: ToolDefinition = {
  name: "gcts_list_repositories",
  description: "List all gCTS repositories configured on the SAP system. Returns repository details including URL, branch, status, and package.",
  inputSchema: z.object({}),
  handler: async () => {
    logger.info("Listing gCTS repositories");
    const data = await gctsRequest("GET", "/repositories");
    return jsonResult(data);
  },
};

export const gctsGetRepository: ToolDefinition = {
  name: "gcts_get_repository",
  description: "Get detailed information about a specific gCTS repository by its ID.",
  inputSchema: z.object({
    id: z.string().describe("Repository ID (UUID format)"),
  }),
  handler: async (args: unknown) => {
    const { id } = args as { id: string };
    logger.info("Getting gCTS repository", { id });
    const data = await gctsRequest("GET", `/repositories/${encodeURIComponent(id)}`);
    return jsonResult(data);
  },
};

export const gctsCreateRepository: ToolDefinition = {
  name: "gcts_create_repository",
  description: "Create a new gCTS repository. Links a remote Git repository to an ABAP package.",
  inputSchema: z.object({
    url: z.string().describe("Remote Git repository URL"),
    branch: z.string().optional().describe("Branch name (defaults to main/master)"),
    package: z.string().describe("ABAP package name to link"),
    role: z.enum(["SOURCE", "TARGET"]).optional().describe("Repository role: SOURCE (development) or TARGET (import). Defaults to SOURCE."),
  }),
  handler: async (args: unknown) => {
    const { url, branch, package: pkg, role } = args as {
      url: string; branch?: string; package: string; role?: string;
    };
    logger.info("Creating gCTS repository", { url, branch, package: pkg, role });
    const body: Record<string, unknown> = {
      repository: url,
      branch: branch || "main",
      package: pkg,
      role: role || "SOURCE",
    };
    const data = await gctsRequest("POST", "/repositories", body);
    return jsonResult(data);
  },
};

export const gctsDeleteRepository: ToolDefinition = {
  name: "gcts_delete_repository",
  description: "Delete a gCTS repository from the system. This removes the repository configuration but does not delete the ABAP objects.",
  inputSchema: z.object({
    id: z.string().describe("Repository ID (UUID format)"),
  }),
  handler: async (args: unknown) => {
    const { id } = args as { id: string };
    logger.info("Deleting gCTS repository", { id });
    await gctsRequest("DELETE", `/repositories/${encodeURIComponent(id)}`);
    return textResult(`Repository ${id} deleted successfully.`);
  },
};

export const gctsCloneRepository: ToolDefinition = {
  name: "gcts_clone_repository",
  description: "Clone a gCTS repository. Downloads the repository content from the remote Git server to the SAP system.",
  inputSchema: z.object({
    id: z.string().describe("Repository ID (UUID format)"),
  }),
  handler: async (args: unknown) => {
    const { id } = args as { id: string };
    logger.info("Cloning gCTS repository", { id });
    const data = await gctsRequest("POST", `/repositories/${encodeURIComponent(id)}/clone`);
    return jsonResult(data);
  },
};

export const gctsPull: ToolDefinition = {
  name: "gcts_pull",
  description: "Pull the latest changes from the remote Git repository into the SAP system via gCTS.",
  inputSchema: z.object({
    id: z.string().describe("Repository ID (UUID format)"),
    commitId: z.string().optional().describe("Specific commit ID to pull to. If omitted, pulls the latest."),
  }),
  handler: async (args: unknown) => {
    const { id, commitId } = args as { id: string; commitId?: string };
    logger.info("Pulling gCTS repository", { id, commitId });
    let path = `/repositories/${encodeURIComponent(id)}/pullByCommit`;
    if (commitId) {
      path += `?request=${encodeURIComponent(commitId)}`;
    }
    const data = await gctsRequest("GET", path);
    return jsonResult(data);
  },
};

export const gctsCommit: ToolDefinition = {
  name: "gcts_commit",
  description: "Commit local changes from the SAP system to the gCTS repository.",
  inputSchema: z.object({
    id: z.string().describe("Repository ID (UUID format)"),
    message: z.string().describe("Commit message"),
    objects: z.array(z.object({
      object: z.string().describe("ABAP object name"),
      type: z.string().describe("ABAP object type"),
    })).optional().describe("List of objects to commit. If omitted, commits all changed objects."),
  }),
  handler: async (args: unknown) => {
    const { id, message, objects } = args as {
      id: string; message: string; objects?: Array<{ object: string; type: string }>;
    };
    logger.info("Committing to gCTS repository", { id, message });
    const body: Record<string, unknown> = { message };
    if (objects) {
      body.objects = objects;
    }
    const data = await gctsRequest("POST", `/repositories/${encodeURIComponent(id)}/commit`, body);
    return jsonResult(data);
  },
};

export const gctsListBranches: ToolDefinition = {
  name: "gcts_list_branches",
  description: "List all branches of a gCTS repository.",
  inputSchema: z.object({
    id: z.string().describe("Repository ID (UUID format)"),
  }),
  handler: async (args: unknown) => {
    const { id } = args as { id: string };
    logger.info("Listing gCTS branches", { id });
    const data = await gctsRequest("GET", `/repositories/${encodeURIComponent(id)}/branches`);
    return jsonResult(data);
  },
};

export const gctsSwitchBranch: ToolDefinition = {
  name: "gcts_switch_branch",
  description: "Switch to a different branch in a gCTS repository.",
  inputSchema: z.object({
    id: z.string().describe("Repository ID (UUID format)"),
    branch: z.string().describe("Branch name to switch to"),
  }),
  handler: async (args: unknown) => {
    const { id, branch } = args as { id: string; branch: string };
    logger.info("Switching gCTS branch", { id, branch });
    const data = await gctsRequest(
      "GET",
      `/repositories/${encodeURIComponent(id)}/switchBranch?branch=${encodeURIComponent(branch)}`
    );
    return jsonResult(data);
  },
};

export const gctsGetHistory: ToolDefinition = {
  name: "gcts_get_history",
  description: "Get the commit history of a gCTS repository.",
  inputSchema: z.object({
    id: z.string().describe("Repository ID (UUID format)"),
  }),
  handler: async (args: unknown) => {
    const { id } = args as { id: string };
    logger.info("Getting gCTS history", { id });
    const data = await gctsRequest("GET", `/repositories/${encodeURIComponent(id)}/getHistory`);
    return jsonResult(data);
  },
};

export const gctsTools: ToolDefinition[] = [
  gctsListRepositories,
  gctsGetRepository,
  gctsCreateRepository,
  gctsDeleteRepository,
  gctsCloneRepository,
  gctsPull,
  gctsCommit,
  gctsListBranches,
  gctsSwitchBranch,
  gctsGetHistory,
];
