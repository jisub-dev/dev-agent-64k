import { promises as fs } from "node:fs";
import path from "node:path";

import { z } from "zod";

import type { Tool, ToolContext, ToolResult } from "./tool.js";

const writeFileInputSchema = z.object({
  file_path: z.string().min(1),
  content: z.string(),
});

type WriteFileInput = z.infer<typeof writeFileInputSchema>;

export class WriteFileTool implements Tool {
  public readonly name = "write_file";
  public readonly description =
    "Creates or overwrites a local text file with the provided content.";
  public readonly inputFormat =
    '{"file_path":"notes.txt","content":"hello world"}';
  public readonly permission = "write" as const;

  public async run(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = writeFileInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        output: `Invalid write_file input: ${parsed.error.message}`,
      };
    }

    return this.writeFile(parsed.data, context);
  }

  private async writeFile(
    input: WriteFileInput,
    context: ToolContext,
  ): Promise<ToolResult> {
    const resolvedPath = path.isAbsolute(input.file_path)
      ? input.file_path
      : path.join(context.cwd, input.file_path);

    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, input.content, "utf8");

    return {
      ok: true,
      output: `Wrote ${input.content.length} characters to ${resolvedPath}`,
    };
  }
}
