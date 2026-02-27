import { explorationTools } from "./exploration.js";
import { modificationTools } from "./modification.js";
import { qualityTools } from "./quality.js";
import { transportTools } from "./transports.js";
import { refactoringTools } from "./refactoring.js";
import { dataServicesTools } from "./data-services.js";
import { debugTools } from "./debug.js";
import { gitTools } from "./git.js";
import type { ToolDefinition } from "../../types/index.js";

export const allTools: ToolDefinition[] = [
  ...explorationTools,
  ...modificationTools,
  ...qualityTools,
  ...transportTools,
  ...refactoringTools,
  ...dataServicesTools,
  ...debugTools,
  ...gitTools,
];

export {
  explorationTools,
  modificationTools,
  qualityTools,
  transportTools,
  refactoringTools,
  dataServicesTools,
  debugTools,
  gitTools,
};
