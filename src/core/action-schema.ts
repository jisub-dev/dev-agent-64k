import { z } from "zod";

export const assistantMessageActionSchema = z.object({
  kind: z.literal("assistant_message"),
  message: z.string().min(1),
});

export const toolCallActionSchema = z.object({
  kind: z.literal("tool_call"),
  tool_name: z.string().min(1),
  tool_input: z.record(z.unknown()).default({}),
});

export const agentActionSchema = z.union([
  assistantMessageActionSchema,
  toolCallActionSchema,
]);

export type AgentAction = z.infer<typeof agentActionSchema>;

export function tryParseAgentAction(input: string): AgentAction | null {
  const candidate = extractJsonCandidate(input);
  if (!candidate) {
    return null;
  }

  try {
    const parsed = JSON.parse(candidate) as unknown;
    return agentActionSchema.parse(normalizeActionShape(parsed));
  } catch {
    return null;
  }
}

function extractJsonCandidate(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    const fencedBody = fencedMatch[1].trim();
    if (fencedBody.startsWith("{") && fencedBody.endsWith("}")) {
      return fencedBody;
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return null;
}

function normalizeActionShape(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const value = input as Record<string, unknown>;
  if (
    typeof value.kind === "string" &&
    value.kind !== "assistant_message" &&
    value.kind !== "tool_call"
  ) {
    const { kind, tool_name, tool_input, ...rest } = value;
    const normalizedToolName =
      typeof tool_name === "string" && tool_name.length > 0
        ? tool_name
        : kind;
    const normalizedToolInput =
      tool_input && typeof tool_input === "object" && !Array.isArray(tool_input)
        ? (tool_input as Record<string, unknown>)
        : rest;

    return {
      kind: "tool_call",
      tool_name: normalizedToolName,
      tool_input: normalizedToolInput,
    };
  }

  return value;
}
