import { tryParseAgentAction } from "./action-schema.js";

import type { ChatMessage, LlmProvider } from "../providers/types.js";
import type { ToolRegistry } from "../tools/registry.js";

type QueryEngineOptions = {
  provider: LlmProvider;
  systemPrompt: string;
  toolRegistry: ToolRegistry;
  cwd: string;
  maxIterations?: number;
};

type SubmitCallbacks = {
  onAssistantUpdate: (content: string) => void;
  onError?: (message: string) => void;
};

export class QueryEngine {
  private readonly provider: LlmProvider;
  private readonly systemPrompt: string;
  private readonly toolRegistry: ToolRegistry;
  private readonly cwd: string;
  private readonly maxIterations: number;
  private readonly transcript: ChatMessage[] = [];

  public constructor(options: QueryEngineOptions) {
    this.provider = options.provider;
    this.systemPrompt = options.systemPrompt;
    this.toolRegistry = options.toolRegistry;
    this.cwd = options.cwd;
    this.maxIterations = options.maxIterations ?? 4;
  }

  public async submitUserMessage(
    content: string,
    callbacks: SubmitCallbacks,
  ): Promise<void> {
    const userMessage: ChatMessage = {
      role: "user",
      content,
    };
    this.transcript.push(userMessage);

    try {
      callbacks.onAssistantUpdate("Thinking...");
      const finalMessage = await this.runAgentLoop(callbacks);
      this.transcript.push({
        role: "assistant",
        content: finalMessage,
      });
      callbacks.onAssistantUpdate(finalMessage);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown provider error";
      callbacks.onError?.(message);
    }
  }

  private buildRequestMessages(): ChatMessage[] {
    return [
      {
        role: "system",
        content: this.systemPrompt,
      },
      ...this.transcript,
    ];
  }

  private async runAgentLoop(callbacks: SubmitCallbacks): Promise<string> {
    for (let iteration = 0; iteration < this.maxIterations; iteration += 1) {
      const raw = await this.collectAssistantResponse();
      const parsedAction = tryParseAgentAction(raw);

      if (!parsedAction) {
        return raw.trim() || "(empty response)";
      }

      if (parsedAction.kind === "assistant_message") {
        return parsedAction.message;
      }

      this.transcript.push({
        role: "assistant",
        content: raw,
      });

      const tool = this.toolRegistry.get(parsedAction.tool_name);
      if (!tool) {
        const errorMessage = `Unknown tool requested: ${parsedAction.tool_name}`;
        this.transcript.push({
          role: "tool",
          name: parsedAction.tool_name,
          content: errorMessage,
        });
        callbacks.onAssistantUpdate(errorMessage);
        continue;
      }

      callbacks.onAssistantUpdate(`Running tool: ${parsedAction.tool_name}...`);
      const result = await tool.run(parsedAction.tool_input, {
        cwd: this.cwd,
      });
      this.transcript.push({
        role: "tool",
        name: parsedAction.tool_name,
        content: result.ok ? result.output : `Tool error: ${result.output}`,
      });
    }

    return "Reached the maximum number of tool iterations without a final answer.";
  }

  private async collectAssistantResponse(): Promise<string> {
    let assistantText = "";

    for await (const event of this.provider.streamChat(this.buildRequestMessages())) {
      if (event.type === "text-delta") {
        assistantText += event.text;
        continue;
      }

      if (event.type === "error") {
        throw new Error(event.error);
      }
    }

    return assistantText;
  }
}
