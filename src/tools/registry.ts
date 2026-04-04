import { ReadFileTool } from "./read-file.js";

import type { Tool, ToolDefinition } from "./tool.js";

export class ToolRegistry {
  private readonly tools: Map<string, Tool>;

  public constructor(tools: Tool[]) {
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
  }

  public get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  public definitions(): ToolDefinition[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputFormat: tool.inputFormat,
    }));
  }
}

export function createDefaultToolRegistry(): ToolRegistry {
  return new ToolRegistry([new ReadFileTool()]);
}
