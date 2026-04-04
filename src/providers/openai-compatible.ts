import OpenAI from "openai";

import type {
  ChatMessage,
  LlmProvider,
  ProviderConfig,
  StreamEvent,
} from "./types.js";

type OpenAICompatibleMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class OpenAICompatibleProvider implements LlmProvider {
  private readonly client: OpenAI;

  public constructor(private readonly config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  public async *streamChat(
    messages: ChatMessage[],
  ): AsyncIterable<StreamEvent> {
    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages: this.toOpenAIMessages(messages),
      stream: true,
      temperature: 0.2,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        yield {
          type: "text-delta",
          text: delta,
        };
      }
    }

    yield {
      type: "completed",
    };
  }

  private toOpenAIMessages(messages: ChatMessage[]): OpenAICompatibleMessage[] {
    return messages.map((message) => {
      if (message.role === "tool") {
        return {
          role: "user",
          content: message.name
            ? `Tool result for ${message.name}:\n${message.content}`
            : `Tool result:\n${message.content}`,
        };
      }

      return {
        role: message.role,
        content: message.content,
      };
    });
  }
}
