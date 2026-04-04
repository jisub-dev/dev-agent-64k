import { spawn } from "node:child_process";

import { z } from "zod";

import type { Tool, ToolContext, ToolResult } from "./tool.js";

const bashInputSchema = z.object({
  command: z.string().min(1),
  timeout_ms: z.number().int().positive().max(120_000).optional(),
});

type BashInput = z.infer<typeof bashInputSchema>;

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_CHARS = 12_000;

export class BashTool implements Tool {
  public readonly name = "bash";
  public readonly description =
    "Runs a shell command in the current working directory. Use this for directory listing, git status, tests, and other terminal tasks.";
  public readonly inputFormat =
    '{"command":"pwd","timeout_ms":15000}';
  public readonly permission = "execute" as const;

  public async run(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = bashInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        output: `Invalid bash input: ${parsed.error.message}`,
      };
    }

    return this.executeCommand(parsed.data, context);
  }

  private async executeCommand(
    input: BashInput,
    context: ToolContext,
  ): Promise<ToolResult> {
    const timeoutMs = input.timeout_ms ?? DEFAULT_TIMEOUT_MS;

    return new Promise((resolve) => {
      const child = spawn("/bin/zsh", ["-lc", input.command], {
        cwd: context.cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let resolved = false;

      const finalize = (result: ToolResult) => {
        if (resolved) {
          return;
        }
        resolved = true;
        clearTimeout(timeoutId);
        resolve(result);
      };

      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        finalize({
          ok: false,
          output: `Failed to run command: ${error.message}`,
        });
      });

      child.on("close", (code, signal) => {
        const body = formatShellResult(stdout, stderr, code, signal);
        finalize({
          ok: code === 0 && signal === null,
          output: body,
        });
      });

      const timeoutId = setTimeout(() => {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!resolved) {
            child.kill("SIGKILL");
          }
        }, 1_000).unref();
        finalize({
          ok: false,
          output: [
            `Command timed out after ${timeoutMs}ms.`,
            formatShellStreams(stdout, stderr),
          ]
            .filter(Boolean)
            .join("\n\n"),
        });
      }, timeoutMs);

      timeoutId.unref();
    });
  }
}

function formatShellResult(
  stdout: string,
  stderr: string,
  code: number | null,
  signal: NodeJS.Signals | null,
): string {
  const sections = [
    `exit_code: ${code ?? "null"}`,
    signal ? `signal: ${signal}` : null,
    formatShellStreams(stdout, stderr),
  ].filter(Boolean);

  return sections.join("\n\n");
}

function formatShellStreams(stdout: string, stderr: string): string {
  const sections = [
    `stdout:\n${truncateOutput(stdout)}`,
    stderr.trim().length > 0 ? `stderr:\n${truncateOutput(stderr)}` : null,
  ].filter(Boolean);

  return sections.join("\n\n");
}

function truncateOutput(output: string): string {
  if (!output) {
    return "(empty)";
  }

  const normalized = output.trimEnd();
  if (normalized.length <= MAX_OUTPUT_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_OUTPUT_CHARS)}\n... [truncated ${
    normalized.length - MAX_OUTPUT_CHARS
  } chars]`;
}
