import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildSystemPrompt } from "../src/core/prompts.js";
import { QueryEngine } from "../src/core/query-engine.js";
import type {
  ChatMessage,
  LlmProvider,
  StreamEvent,
} from "../src/providers/types.js";
import { createDefaultToolRegistry } from "../src/tools/registry.js";

class ReplayProvider implements LlmProvider {
  public callCount = 0;

  public constructor(private readonly responses: string[]) {}

  public async *streamChat(
    _messages: ChatMessage[],
  ): AsyncIterable<StreamEvent> {
    this.callCount += 1;
    const next = this.responses.shift();
    if (!next) {
      throw new Error("No replay response available");
    }

    yield {
      type: "text-delta",
      text: next,
    };
    yield {
      type: "completed",
    };
  }
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("QueryEngine", () => {
  it("bypasses the model for direct file excerpt requests", async () => {
    const cwd = await createTempDir();
    await writeFile(
      path.join(cwd, "README.md"),
      "# Dev-Agent\n\nhello\nworld\n",
      "utf8",
    );

    const provider = new ReplayProvider([]);
    const registry = createDefaultToolRegistry();
    const engine = new QueryEngine({
      provider,
      systemPrompt: buildSystemPrompt(registry.definitions()),
      toolRegistry: registry,
      cwd,
    });

    let final = "";
    await engine.submitUserMessage("이 폴더에 있는 readme 파일 초반 읽어줘", {
      onAssistantUpdate: (content) => {
        final = content;
      },
      onPermissionRequest: async () => ({
        decision: "allow",
        scope: "session",
      }),
    });

    expect(provider.callCount).toBe(0);
    expect(final).toContain("README.md 초반은 아래와 같습니다.");
    expect(final).toContain("# Dev-Agent");
  });

  it("executes shorthand write_file actions and follows up with the assistant reply", async () => {
    const cwd = await createTempDir();
    const provider = new ReplayProvider([
      JSON.stringify({
        kind: "write_file",
        file_path: "notes.txt",
        content: "안녕",
      }),
      JSON.stringify({
        kind: "assistant_message",
        message: "파일을 작성했습니다.",
      }),
    ]);
    const registry = createDefaultToolRegistry();
    const engine = new QueryEngine({
      provider,
      systemPrompt: buildSystemPrompt(registry.definitions()),
      toolRegistry: registry,
      cwd,
    });

    let final = "";
    await engine.submitUserMessage("notes.txt 파일 만들고 안녕 이라고 써줘", {
      onAssistantUpdate: (content) => {
        final = content;
      },
      onPermissionRequest: async () => ({
        decision: "allow",
        scope: "session",
      }),
    });

    const written = await readFile(path.join(cwd, "notes.txt"), "utf8");
    expect(written).toBe("안녕");
    expect(final).toBe("파일을 작성했습니다.");
    expect(provider.callCount).toBe(2);
  });
});

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dev-agent-test-"));
  tempDirs.push(directory);
  return directory;
}
