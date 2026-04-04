import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import React from "react";

type PromptInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
};

export function PromptInput({ value, onChange, onSubmit }: PromptInputProps) {
  return (
    <Box>
      <Text color="cyanBright">{"> "}</Text>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder="Ask dev-agent to inspect, edit, or run something..."
      />
    </Box>
  );
}
