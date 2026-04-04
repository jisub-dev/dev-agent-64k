import { Box, Text } from "ink";
import React from "react";

type StatusBarProps = {
  cwd: string;
  model: string;
  baseUrl: string;
};

export function StatusBar({ cwd, model, baseUrl }: StatusBarProps) {
  return (
    <Box justifyContent="space-between">
      <Text color="gray">cwd: {cwd}</Text>
      <Text color="gray">model: {model}</Text>
      <Text color="gray">server: {baseUrl}</Text>
    </Box>
  );
}
