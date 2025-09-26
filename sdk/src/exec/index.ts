// src/exec/index.ts
// Execution module exports: DSL loader, executor, error types

export { loadDSLFromUrl } from "./loader.js";           // Loads DSL from file URL
export { execFromFile } from "./executor.js";           // Executes DSL action from file
export { UnsupportedExecutionError } from "./errors.js"; // Custom error for unsupported execution
export { runAgentAction } from "./agent.js";           // run agent-level actions (helper)
