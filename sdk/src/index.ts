// src/index.ts
// Entry point: re-exports core modules and main intent executor

export * from "./core/index.js";      // Core types, validators, utilities
export * from "./exec/index.js";      // Execution engine and helpers
export { executeIntent } from "./intent/execute.js"; // Main intent executor
export { runAgentAction } from "./exec/agent.js";

// Note: parser (parsePlanLLM / makeMockLLM) removed for MVP