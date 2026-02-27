import { z } from "zod";
import { ensureLoggedIn } from "../adt-client.js";
import { type ToolDefinition, textResult, jsonResult } from "../../types/index.js";
import { logger } from "../logger.js";

export const listGitRepos: ToolDefinition = {
  name: "list_git_repos",
  description: "List all abapGit repositories linked to the SAP system. Returns repo details including package, URL, branch.",
  inputSchema: z.object({}),
  handler: async () => {
    const client = await ensureLoggedIn();
    const repos = await client.gitRepos();
    if (!repos || repos.length === 0) {
      return textResult("No abapGit repositories linked.");
    }
    return jsonResult(repos);
  },
};

export const gitPull: ToolDefinition = {
  name: "git_pull",
  description: "Pull latest changes from a linked abapGit repository into the SAP system.",
  inputSchema: z.object({
    repoId: z.string().describe("Repository ID from list_git_repos"),
    branch: z.string().optional().describe("Branch to pull from"),
    transport: z.string().optional().describe("Transport number"),
  }),
  handler: async (args: unknown) => {
    const { repoId, branch, transport } = args as { repoId: string; branch?: string; transport?: string };
    const client = await ensureLoggedIn();
    logger.info("Pulling git repo", { repoId });
    await client.gitPullRepo(repoId, branch, transport);
    return textResult("Git pull completed successfully.");
  },
};

export const gitTools: ToolDefinition[] = [
  listGitRepos,
  gitPull,
];
