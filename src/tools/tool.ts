export type ToolContext = {
  cwd: string;
};

export type ToolResult = {
  ok: boolean;
  output: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputFormat: string;
};

export interface Tool {
  name: string;
  description: string;
  inputFormat: string;
  run(input: unknown, context: ToolContext): Promise<ToolResult>;
}
