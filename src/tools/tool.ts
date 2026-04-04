export type ToolContext = {
  cwd: string;
};

export type ToolPermission = "read" | "write" | "execute";

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
  permission: ToolPermission;
  run(input: unknown, context: ToolContext): Promise<ToolResult>;
}
