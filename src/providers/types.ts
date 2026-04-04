import type { MessageRole } from "../core/message-types.js";

export type ProviderConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type ChatMessage = {
  role: MessageRole;
  content: string;
  name?: string;
};

export type StreamEvent =
  | {
      type: "text-delta";
      text: string;
    }
  | {
      type: "completed";
    }
  | {
      type: "error";
      error: string;
    };

export interface LlmProvider {
  streamChat(messages: ChatMessage[]): AsyncIterable<StreamEvent>;
}
