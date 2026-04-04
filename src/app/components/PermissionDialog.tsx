import { Box, Text, useInput } from "ink";
import React from "react";

import type {
  PermissionDecision,
  PermissionMemoryScope,
  PermissionRequest,
} from "../../permissions/types.js";

type PermissionDialogProps = {
  request: PermissionRequest;
  onDecision: (
    decision: PermissionDecision,
    scope: PermissionMemoryScope,
  ) => void;
};

export function PermissionDialog({
  request,
  onDecision,
}: PermissionDialogProps) {
  useInput((input) => {
    if (input === "a") {
      onDecision("allow", "once");
      return;
    }

    if (input === "s") {
      onDecision("allow", "session");
      return;
    }

    if (input === "d") {
      onDecision("deny", "once");
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      marginTop={1}
    >
      <Text color="yellow">Permission Required</Text>
      <Text>tool: {request.toolName}</Text>
      <Text>permission: {request.toolPermission}</Text>
      <Text>{request.summary}</Text>
      <Text color="gray">a = allow once, s = allow for session, d = deny</Text>
    </Box>
  );
}
