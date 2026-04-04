import fg from "fast-glob";
import path from "node:path";

import { tryParseAgentAction } from "./action-schema.js";

import type {
  PermissionDecision,
  PermissionMemoryScope,
  PermissionRequest,
} from "../permissions/types.js";
import type { ChatMessage, LlmProvider } from "../providers/types.js";
import type { ToolRegistry } from "../tools/registry.js";

type QueryEngineOptions = {
  provider: LlmProvider;
  systemPrompt: string;
  toolRegistry: ToolRegistry;
  cwd: string;
  maxIterations?: number;
  initialTranscript?: ChatMessage[];
};

type SubmitCallbacks = {
  onAssistantUpdate: (content: string) => void;
  onError?: (message: string) => void;
  onPermissionRequest?: (
    request: PermissionRequest,
  ) => Promise<{
    decision: PermissionDecision;
    scope: PermissionMemoryScope;
  }>;
};

export class QueryEngine {
  private readonly provider: LlmProvider;
  private readonly systemPrompt: string;
  private readonly toolRegistry: ToolRegistry;
  private readonly cwd: string;
  private readonly maxIterations: number;
  private readonly transcript: ChatMessage[];

  public constructor(options: QueryEngineOptions) {
    this.provider = options.provider;
    this.systemPrompt = options.systemPrompt;
    this.toolRegistry = options.toolRegistry;
    this.cwd = options.cwd;
    this.maxIterations = options.maxIterations ?? 4;
    this.transcript = options.initialTranscript
      ? options.initialTranscript.map((message) => ({ ...message }))
      : [];
  }

  public getTranscript(): ChatMessage[] {
    return this.transcript.map((message) => ({ ...message }));
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
      const directReadResponse = await this.maybeHandleDirectReadRequest(
        content,
        callbacks,
      );
      if (directReadResponse) {
        this.transcript.push({
          role: "assistant",
          content: directReadResponse,
        });
        callbacks.onAssistantUpdate(directReadResponse);
        return;
      }

      const finalMessage = await this.runAgentLoop(callbacks, {
        forceWorkspaceInspection: requiresWorkspaceInspection(content),
        preferDirectFileExcerpt: requiresDirectFileExcerpt(content),
      });
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

  private async maybeHandleDirectReadRequest(
    content: string,
    callbacks: SubmitCallbacks,
  ): Promise<string | null> {
    const directReadInput = await inferDirectReadToolInput(content, this.cwd);
    if (!directReadInput) {
      return null;
    }

    const result = await this.executeToolCall(
      "read_file",
      directReadInput,
      callbacks,
    );
    if (result.status === "ok") {
      return formatDirectReadResponse(result.output);
    }

    return result.output;
  }

  private buildRequestMessages(extraDirective?: string): ChatMessage[] {
    const systemContent = extraDirective
      ? `${this.systemPrompt}\n\n${extraDirective}`
      : this.systemPrompt;

    return [
      {
        role: "system",
        content: systemContent,
      },
      ...this.transcript,
    ];
  }

  private async runAgentLoop(
    callbacks: SubmitCallbacks,
    options: {
      forceWorkspaceInspection: boolean;
      preferDirectFileExcerpt: boolean;
    },
  ): Promise<string> {
    let hasUsedToolThisTurn = false;
    let hasRetriedWithoutTool = false;

    for (let iteration = 0; iteration < this.maxIterations; iteration += 1) {
      const raw = await this.collectAssistantResponse(
        shouldForceToolDirective(
          options.forceWorkspaceInspection,
          hasUsedToolThisTurn,
          hasRetriedWithoutTool,
        ),
      );
      const parsedAction = tryParseAgentAction(raw);

      if (!parsedAction) {
        return raw.trim() || "(empty response)";
      }

      if (parsedAction.kind === "assistant_message") {
        if (options.forceWorkspaceInspection && !hasUsedToolThisTurn && !hasRetriedWithoutTool) {
          hasRetriedWithoutTool = true;
          continue;
        }
        return parsedAction.message;
      }

      this.transcript.push({
        role: "assistant",
        content: raw,
      });

      const result = await this.executeToolCall(
        parsedAction.tool_name,
        parsedAction.tool_input,
        callbacks,
      );
      hasUsedToolThisTurn = result.status === "ok";

      if (
        options.preferDirectFileExcerpt &&
        parsedAction.tool_name === "read_file" &&
        result.status === "ok"
      ) {
        return extractLeadingFileExcerpt(result.output);
      }
    }

    return "Reached the maximum number of tool iterations without a final answer.";
  }

  private async collectAssistantResponse(
    extraDirective?: string,
  ): Promise<string> {
    let assistantText = "";

    for await (const event of this.provider.streamChat(
      this.buildRequestMessages(extraDirective),
    )) {
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

  private async executeToolCall(
    toolName: string,
    toolInput: Record<string, unknown>,
    callbacks: SubmitCallbacks,
  ): Promise<{
    status: "ok" | "error" | "deny" | "missing";
    output: string;
  }> {
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      const errorMessage = `Unknown tool requested: ${toolName}`;
      this.transcript.push({
        role: "tool",
        name: toolName,
        content: errorMessage,
      });
      callbacks.onAssistantUpdate(errorMessage);
      return {
        status: "missing",
        output: errorMessage,
      };
    }

    const permissionRequest: PermissionRequest = {
      toolName: tool.name,
      toolPermission: tool.permission,
      summary: `${tool.name} with input ${JSON.stringify(toolInput)}`,
    };
    const permissionOutcome = await callbacks.onPermissionRequest?.(
      permissionRequest,
    );
    if (permissionOutcome?.decision === "deny") {
      const deniedMessage = `Permission denied for ${tool.name}.`;
      this.transcript.push({
        role: "tool",
        name: tool.name,
        content: deniedMessage,
      });
      callbacks.onAssistantUpdate(deniedMessage);
      return {
        status: "deny",
        output: deniedMessage,
      };
    }

    callbacks.onAssistantUpdate(`Running tool: ${toolName}...`);
    const result = await tool.run(toolInput, {
      cwd: this.cwd,
    });
    const transcriptContent = result.ok ? result.output : `Tool error: ${result.output}`;
    this.transcript.push({
      role: "tool",
      name: tool.name,
      content: transcriptContent,
    });
    return {
      status: result.ok ? "ok" : "error",
      output: transcriptContent,
    };
  }
}

function requiresWorkspaceInspection(input: string): boolean {
  const text = input.toLowerCase();
  return [
    "readme",
    ".md",
    ".ts",
    ".tsx",
    ".json",
    "file",
    "files",
    "folder",
    "directory",
    "repo",
    "repository",
    "project structure",
    "current folder",
    "이 폴더",
    "현재 폴더",
    "파일",
    "폴더",
    "프로젝트 구조",
    "내용",
    "초반",
    "첫 줄",
    "첫줄",
    "line",
    "lines",
  ].some((keyword) => text.includes(keyword));
}

function requiresDirectFileExcerpt(input: string): boolean {
  const text = input.toLowerCase();
  return [
    "초반",
    "앞부분",
    "첫 줄",
    "첫줄",
    "처음 부분",
    "내용 그대로",
    "원문",
    "verbatim",
    "exact",
    "first lines",
    "beginning",
  ].some((keyword) => text.includes(keyword));
}

function shouldForceToolDirective(
  forceWorkspaceInspection: boolean,
  hasUsedToolThisTurn: boolean,
  hasRetriedWithoutTool: boolean,
): string | undefined {
  if (!forceWorkspaceInspection || hasUsedToolThisTurn) {
    return undefined;
  }

  if (hasRetriedWithoutTool) {
    return [
      "Your previous answer skipped required repository inspection.",
      "Your next response must be a tool_call.",
      "Use read_file for file contents or glob for discovery before answering.",
    ].join("\n");
  }

  return [
    "This user request is repository-specific.",
    "Do not answer from memory.",
    "Use read_file or glob before answering.",
  ].join("\n");
}

function extractLeadingFileExcerpt(toolOutput: string): string {
  const lines = toolOutput.split("\n");
  const excerptLines = lines
    .filter((line, index) => index > 0 && !line.startsWith("... ("))
    .slice(0, 12);
  return excerptLines.join("\n").trim();
}

async function inferDirectReadToolInput(
  input: string,
  cwd: string,
): Promise<{ file_path: string; limit: number } | null> {
  if (!shouldBypassModelForDirectRead(input)) {
    return null;
  }

  const explicitPath = extractExplicitFilePath(input);
  const patterns = buildCandidatePatterns(input, explicitPath);
  if (patterns.length === 0) {
    return null;
  }

  const matches = await fg(patterns, {
    cwd,
    absolute: true,
    onlyFiles: true,
    dot: true,
    unique: true,
    suppressErrors: true,
    caseSensitiveMatch: false,
  });
  const bestMatch = chooseBestCandidate(matches);
  if (!bestMatch) {
    return null;
  }

  return {
    file_path: bestMatch,
    limit: requiresDirectFileExcerpt(input) ? 40 : 120,
  };
}

function shouldBypassModelForDirectRead(input: string): boolean {
  if (requiresDirectFileExcerpt(input)) {
    return true;
  }

  const text = input.toLowerCase();
  return [
    "내용 그대로",
    "원문",
    "그대로 보여",
    "show the contents",
    "show the content",
    "show me the file",
    "verbatim",
  ].some((keyword) => text.includes(keyword));
}

function extractExplicitFilePath(input: string): string | null {
  const matches = input.match(
    /(?:[.~A-Za-z0-9_-]+[\\/])*[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+/g,
  );
  if (!matches || matches.length === 0) {
    return null;
  }

  return matches[0] ?? null;
}

function buildCandidatePatterns(
  input: string,
  explicitPath: string | null,
): string[] {
  const patterns = new Set<string>();
  const lowered = input.toLowerCase();

  if (explicitPath) {
    patterns.add(explicitPath);
    patterns.add(`**/${explicitPath}`);
  }

  if (lowered.includes("readme")) {
    patterns.add("README*");
    patterns.add("readme*");
    patterns.add("**/README*");
    patterns.add("**/readme*");
  }

  return [...patterns];
}

function chooseBestCandidate(matches: string[]): string | null {
  if (matches.length === 0) {
    return null;
  }

  return [...matches].sort((left, right) => {
    return scoreFileCandidate(left) - scoreFileCandidate(right);
  })[0]!;
}

function scoreFileCandidate(candidate: string): number {
  const normalized = candidate.toLowerCase();
  const baseName = path.basename(normalized);
  const depth = normalized.split(path.sep).length;
  let score = depth * 10;

  if (baseName === "readme.md") {
    score -= 100;
  } else if (baseName === "readme") {
    score -= 90;
  } else if (baseName.startsWith("readme")) {
    score -= 80;
  }

  return score;
}

function formatDirectReadResponse(toolOutput: string): string {
  const excerpt = extractLeadingFileExcerpt(toolOutput);
  const filePath = extractFilePathFromToolOutput(toolOutput);
  if (!filePath) {
    return excerpt;
  }

  return `${path.basename(filePath)} 초반은 아래와 같습니다.\n\n${excerpt}`;
}

function extractFilePathFromToolOutput(toolOutput: string): string | null {
  const firstLine = toolOutput.split("\n", 1)[0] ?? "";
  if (!firstLine.startsWith("File: ")) {
    return null;
  }

  return firstLine.slice("File: ".length).trim() || null;
}
