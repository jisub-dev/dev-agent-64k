import { promises as fs } from "node:fs";
import path from "node:path";

import { z } from "zod";

import type { Tool, ToolContext, ToolResult } from "./tool.js";

const readFileInputSchema = z.object({
  file_path: z.string().min(1),
  offset: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(2000).optional(),
});

type ReadFileInput = z.infer<typeof readFileInputSchema>;

export class ReadFileTool implements Tool {
  public readonly name = "read_file";
  public readonly description =
    "Reads a local text file. Returns numbered lines. Use this before summarizing or editing repository files.";
  public readonly inputFormat =
    '{"file_path":"README.md","offset":1,"limit":200}';

  public async run(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = readFileInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        output: `Invalid read_file input: ${parsed.error.message}`,
      };
    }

    return this.readFile(parsed.data, context);
  }

  private async readFile(
    input: ReadFileInput,
    context: ToolContext,
  ): Promise<ToolResult> {
    const resolvedPath = path.isAbsolute(input.file_path)
      ? input.file_path
      : path.join(context.cwd, input.file_path);

    let stat;
    try {
      stat = await fs.stat(resolvedPath);
    } catch {
      return {
        ok: false,
        output: `File not found: ${resolvedPath}`,
      };
    }

    if (stat.isDirectory()) {
      return {
        ok: false,
        output: `${resolvedPath} is a directory, not a file.`,
      };
    }

    let content: string;
    try {
      content = await fs.readFile(resolvedPath, "utf8");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown read error";
      return {
        ok: false,
        output: `Failed to read file: ${message}`,
      };
    }

    if (content.length === 0) {
      return {
        ok: true,
        output: `[File ${resolvedPath} is empty]`,
      };
    }

    const lines = content.split(/\r?\n/);
    const offset = input.offset ?? 1;
    const limit = input.limit ?? 200;
    const startIndex = Math.max(offset - 1, 0);
    const endIndex = Math.min(startIndex + limit, lines.length);

    if (startIndex >= lines.length) {
      return {
        ok: false,
        output: `Offset ${offset} exceeds total line count ${lines.length}.`,
      };
    }

    const width = String(endIndex).length;
    const body = lines
      .slice(startIndex, endIndex)
      .map((line, index) => {
        const lineNumber = startIndex + index + 1;
        return `${String(lineNumber).padStart(width, " ")}\t${line}`;
      })
      .join("\n");

    const trailing =
      endIndex < lines.length
        ? `\n\n... (${lines.length - endIndex} more lines, ${lines.length} total)`
        : "";

    return {
      ok: true,
      output: `File: ${resolvedPath}\n${body}${trailing}`,
    };
  }
}
