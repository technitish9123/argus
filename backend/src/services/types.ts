export type RunStatus = "starting" | "waiting_for_funds" | "running" | "exited" | "error" | "killed";

export interface Strategy {
    id: string;
    name: string;
    description?: string;
    scriptPath: string;
    metadata?: Record<string, any>;
    createdAt: number;
    updatedAt: number;
}

export interface Run {
    id: string;
    strategyId: string;
    params: Record<string, any>;
    status: RunStatus;
    startedAt: number;
    finishedAt?: number;
    logs: string[];
    botAddress?: string;
    botIndex?: number;
    owner?: string; // optional owner id (e.g., wallet address) to mark runs as belonging to a user
}

export interface DB {
    strategies: Strategy[];
    runs: Run[];
}
