import { Box, Text, useApp, useInput } from "ink";
import React, { useMemo, useState } from "react";

import { MessageList } from "./MessageList.js";
import { PromptInput } from "./PromptInput.js";
import { StatusBar } from "./StatusBar.js";

import type { AppMessage } from "../../core/message-types.js";
import { buildSystemPrompt } from "../../core/prompts.js";
import { QueryEngine } from "../../core/query-engine.js";
import { OpenAICompatibleProvider } from "../../providers/openai-compatible.js";
import { createDefaultToolRegistry } from "../../tools/registry.js";
import type { ProviderConfig } from "../../providers/types.js";

type AppProps = {
  config: ProviderConfig;
  cwd: string;
};

function createWelcomeMessage(config: ProviderConfig): AppMessage {
  return {
    id: "welcome",
    role: "assistant",
    content: `Connected scaffold ready. Target model: ${config.model}`,
  };
}

export function App({ config, cwd }: AppProps) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<AppMessage[]>([
    createWelcomeMessage(config),
  ]);
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queryEngine = useMemo(() => {
    const provider = new OpenAICompatibleProvider(config);
    const toolRegistry = createDefaultToolRegistry();
    return new QueryEngine({
      provider,
      systemPrompt: buildSystemPrompt(toolRegistry.definitions()),
      toolRegistry,
      cwd,
    });
  }, [config, cwd]);

  const status = useMemo(
    () => ({
      cwd,
      model: config.model,
      baseUrl: config.baseUrl,
      mode: isSubmitting ? "requesting" : "idle",
    }),
    [config.baseUrl, config.model, cwd, isSubmitting],
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
    });

    setIsSubmitting(false);
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
        <PromptInput
          value={input}
          onChange={setInput}
          onSubmit={submitInput}
        />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}
