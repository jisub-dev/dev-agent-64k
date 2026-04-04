export type MessageRole = "system" | "user" | "assistant" | "tool";

export type AppMessage = {
  id: string;
  role: MessageRole;
  content: string;
};
