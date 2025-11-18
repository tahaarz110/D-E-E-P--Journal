export interface PluginManifest {
    name: string;
    version: string;
    description: string;
    author: string;
    commands: {
      [commandName: string]: CommandDefinition;
    };
  }
  
  export interface CommandDefinition {
    name: string;
    description: string;
    input_schema: any;
    output_schema: any;
  }
  
  export interface PluginInfo {
    name: string;
    version: string;
    description: string;
    author: string;
    commands: CommandDefinition[];
  }
  
  export interface PluginExecutionResult {
    success: boolean;
    data?: any;
    error?: string;
    executionTime?: number;
  }