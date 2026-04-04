import { Box, Text } from "ink";
import React from "react";

import type { AppMessage } from "../../core/message-types.js";

type MessageListProps = {
  messages: AppMessage[];
};

function colorForRole(role: AppMessage["role"]): string {
  switch (role) {
    case "user":
      return "green";
    case "assistant":
      return "yellow";
    case "system":
      return "blue";
    case "tool":
      return "magenta";
  }
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <Box flexDirection="column">
      {messages.map((message) => (
        <Box key={message.id} marginBottom={1} flexDirection="column">
          <Text color={colorForRole(message.role)}>
            {message.role.toUpperCase()}
          </Text>
          <Text>{message.content}</Text>
        </Box>
      ))}
    </Box>
  );
}
