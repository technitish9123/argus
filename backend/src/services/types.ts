export type RunStatus = "starting" | "running" | "exited" | "error" | "killed";

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
}

export interface DB {
    strategies: Strategy[];
    runs: Run[];
}
