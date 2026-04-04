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
    "When the user asks about file contents, project structure, repository details, or the current folder, use a tool call instead of guessing.",
    "If the user asks for the beginning of a file, exact file text, first lines, or current folder contents, you must inspect files with tools before answering.",
    "Do not answer from memory for repository-specific questions.",
    "If the user asked for actual file content, quote or present the real content from the tool result instead of paraphrasing.",
    "After a tool result is provided, decide whether to call another tool or answer the user.",
    "Available tools:",
    toolList,
    "If you already have enough information to answer, return assistant_message.",
  ].join("\n");
}
