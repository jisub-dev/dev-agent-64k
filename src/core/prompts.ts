import type { ToolDefinition } from "../tools/tool.js";

export function buildSystemPrompt(tools: ToolDefinition[]): string {
  const toolList = tools
    .map(
      (tool) =>
        `- ${tool.name}: ${tool.description}\n  input: ${tool.inputFormat}`,
    )
    .join("\n");

  return [
    "You are dev-agent, a coding assistant running in a local CLI.",
    "You must return exactly one JSON object and nothing else.",
    'Valid shapes are {"kind":"assistant_message","message":"..."} or {"kind":"tool_call","tool_name":"...","tool_input":{...}}.',
    "Do not use markdown code fences.",
    "When the user asks about file contents, project structure, or repository details, use a tool call instead of guessing.",
    "After a tool result is provided, decide whether to call another tool or answer the user.",
    "Available tools:",
    toolList,
    "If you already have enough information to answer, return assistant_message.",
  ].join("\n");
}
