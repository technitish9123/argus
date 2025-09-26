export type InputSpec = {
  type: string;              // 'uint' | 'address' | 'token' | 'bps' | 'enum' | 'bool' | 'bytes' | 'string'
  required?: boolean;
  description?: string;
  decimals?: number;
  enum?: (string | number)[];
  min?: number;
  max?: number;
  default?: any;
  format?: string;
  examples?: any[];
};

export type AptosExecution = {
  module: string;
  function: string;
  type_arguments?: string[];
  arguments?: any[];
};

export type SuiExecution = {
  package: string;
  module: string;
  function: string;
  arguments?: any[];
};

export type DSL = {
  dsl_version: "0.1";
  protocol: {
    name: string;
    version: string;
    chainId?: number;
    website?: string;
    documentation?: string;
  };
  action: {
    name: string;
    summary: string;
    category?: string;
    intents?: string[];
  };
  io: {
    inputs: Record<string, InputSpec>;
    outputs?: Record<string, any>;
  };
  defaults?: Record<string, any>;
  constraints?: Record<string, any>;
  risks?: string[];
  metadata?: Record<string, any>;
  execution: {
    evm?: {
      chainId: number;
      contract: string;
      method: string;
      structure?: "object" | "tuple";
      arg_object?: Record<string, any>;
      abi: any[];
      value?: string;
      gas_limit?: number;
    };
    aptos?: AptosExecution;
    sui?: SuiExecution;
  };
};
