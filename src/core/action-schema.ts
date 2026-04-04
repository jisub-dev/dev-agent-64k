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
  const trimmed = input.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return agentActionSchema.parse(parsed);
  } catch {
    return null;
  }
}
