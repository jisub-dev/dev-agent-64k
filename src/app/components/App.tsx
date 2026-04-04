import { Box, Text, useApp, useInput } from "ink";
import React, { useMemo, useState } from "react";

import { MessageList } from "./MessageList.js";
import { PermissionDialog } from "./PermissionDialog.js";
import { PromptInput } from "./PromptInput.js";
import { StatusBar } from "./StatusBar.js";

import type { AppMessage } from "../../core/message-types.js";
import { PermissionEngine } from "../../permissions/engine.js";
import type {
  PermissionDecision,
  PermissionMemoryScope,
  PermissionRequest,
} from "../../permissions/types.js";
import { buildSystemPrompt } from "../../core/prompts.js";
import { QueryEngine } from "../../core/query-engine.js";
import { OpenAICompatibleProvider } from "../../providers/openai-compatible.js";
import { createDefaultToolRegistry } from "../../tools/registry.js";
import type { ProviderConfig } from "../../providers/types.js";
import type {
  SessionSnapshot,
  SessionStore,
} from "../../storage/session-store.js";

type AppProps = {
  config: ProviderConfig;
  cwd: string;
  sessionStore: SessionStore;
  initialSession: SessionSnapshot;
  resumed: boolean;
};

function createWelcomeMessage(config: ProviderConfig): AppMessage {
  return {
    id: "welcome",
    role: "assistant",
    content: `Connected scaffold ready. Target model: ${config.model}`,
  };
}

export function App({
  config,
  cwd,
  sessionStore,
  initialSession,
  resumed,
}: AppProps) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<AppMessage[]>(() =>
    buildInitialMessages(config, initialSession, resumed),
  );
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingPermission, setPendingPermission] = useState<{
    request: PermissionRequest;
    resolve: (value: {
      decision: PermissionDecision;
      scope: PermissionMemoryScope;
    }) => void;
  } | null>(null);
  const permissionEngine = useMemo(() => new PermissionEngine("default"), []);

  const queryEngine = useMemo(() => {
    const provider = new OpenAICompatibleProvider(config);
    const toolRegistry = createDefaultToolRegistry();
    return new QueryEngine({
      provider,
      systemPrompt: buildSystemPrompt(toolRegistry.definitions()),
      toolRegistry,
      cwd,
      initialTranscript: initialSession.messages,
    });
  }, [config, cwd, initialSession.messages]);

  const status = useMemo(
    () => ({
      cwd,
      model: config.model,
      baseUrl: config.baseUrl,
      mode: pendingPermission
        ? "waiting-permission"
        : isSubmitting
          ? "requesting"
          : "idle",
    }),
    [config.baseUrl, config.model, cwd, isSubmitting, pendingPermission],
  );

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
    }
  });

  const submitInput = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isSubmitting) {
      return;
    }

    const messageBase = Date.now();
    const userId = `user-${messageBase}`;
    const assistantId = `assistant-${messageBase}`;
    const userMessage: AppMessage = {
      id: userId,
      role: "user",
      content: trimmed,
    };
    const assistantMessage: AppMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    setMessages((current) => {
      const nextMessages: AppMessage[] = [
        ...current,
        userMessage,
        assistantMessage,
      ];
      return nextMessages;
    });
    setInput("");
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await queryEngine.submitUserMessage(trimmed, {
        onAssistantUpdate: (content) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId ? { ...message, content } : message,
            ),
          );
        },
        onError: (message) => {
          setErrorMessage(message);
          setMessages((current) =>
            current.map((entry) =>
              entry.id === assistantId
                ? {
                    ...entry,
                    content: `Provider error: ${message}`,
                  }
                : entry,
            ),
          );
        },
        onPermissionRequest: async (request) => {
          const initialDecision = permissionEngine.evaluate(request);
          if (initialDecision === "allow") {
            return {
              decision: "allow",
              scope: "once",
            };
          }

          if (initialDecision === "deny") {
            return {
              decision: "deny",
              scope: "once",
            };
          }

          return new Promise((resolve) => {
            setPendingPermission({
              request,
              resolve,
            });
          });
        },
      });
    } finally {
      const now = new Date().toISOString();
      try {
        await sessionStore.save({
          sessionId: initialSession.sessionId,
          cwd,
          createdAt: initialSession.createdAt,
          updatedAt: now,
          messages: queryEngine.getTranscript(),
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown session save error";
        setErrorMessage(`Session save failed: ${message}`);
      }
      setIsSubmitting(false);
    }
  };

  const handlePermissionDecision = (
    decision: PermissionDecision,
    scope: PermissionMemoryScope,
  ) => {
    if (!pendingPermission) {
      return;
    }

    if (scope === "session") {
      permissionEngine.rememberSessionDecision(
        pendingPermission.request,
        decision,
      );
    }

    pendingPermission.resolve({
      decision,
      scope,
    });
    setPendingPermission(null);
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      <StatusBar
        cwd={status.cwd}
        model={status.model}
        baseUrl={status.baseUrl}
      />
      <Box marginTop={1}>
        <Text color="cyanBright">Dev-Agent</Text>
        <Text color="gray">  Claude Code style local CLI scaffold</Text>
      </Box>
      <Box>
        <Text color="gray">
          session: {initialSession.sessionId}
          {resumed ? " (resumed latest)" : ""}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <MessageList messages={messages} />
      </Box>
      <Box marginTop={1}>
        <Text color={isSubmitting ? "yellow" : "gray"}>
          status: {status.mode}
        </Text>
      </Box>
      {errorMessage ? (
        <Box>
          <Text color="red">last error: {errorMessage}</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        {pendingPermission ? (
          <PermissionDialog
            request={pendingPermission.request}
            onDecision={handlePermissionDecision}
          />
        ) : (
          <PromptInput
            value={input}
            onChange={setInput}
            onSubmit={submitInput}
          />
        )}
      </Box>
      <Box marginTop={1}>
        <Text color="gray">Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}

function buildInitialMessages(
  config: ProviderConfig,
  initialSession: SessionSnapshot,
  resumed: boolean,
): AppMessage[] {
  const messages: AppMessage[] = [createWelcomeMessage(config)];

  if (resumed) {
    messages.push({
      id: "resume-note",
      role: "system",
      content: `Resumed latest session from ${initialSession.updatedAt}`,
    });
  }

  initialSession.messages.forEach((message, index) => {
    messages.push({
      id: `history-${index}`,
      role: message.role,
      content: message.content,
    });
  });

  return messages;
}
