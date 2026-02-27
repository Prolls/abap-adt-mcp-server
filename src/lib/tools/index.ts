import { explorationTools } from "./exploration.js";
import { modificationTools } from "./modification.js";
import { qualityTools } from "./quality.js";
import { transportTools } from "./transports.js";
import { refactoringTools } from "./refactoring.js";
import { dataServicesTools } from "./data-services.js";
import { debugTools } from "./debug.js";
import { gitTools } from "./git.js";
import { gctsTools } from "./gcts.js";
import { systemTools } from "./system.js";
import { ddicTools } from "./ddic.js";
import { translationTools } from "./translation.js";
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
  ...gctsTools,
  ...systemTools,
  ...ddicTools,
  ...translationTools,
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
  gctsTools,
  systemTools,
  ddicTools,
  translationTools,
};
