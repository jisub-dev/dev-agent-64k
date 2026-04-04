import { promises as fs } from "node:fs";
import path from "node:path";

import { z } from "zod";

import type { Tool, ToolContext, ToolResult } from "./tool.js";

const editFileInputSchema = z.object({
  file_path: z.string().min(1),
  old_string: z.string(),
  new_string: z.string(),
  replace_all: z.boolean().optional(),
});

type EditFileInput = z.infer<typeof editFileInputSchema>;

export class EditFileTool implements Tool {
  public readonly name = "edit_file";
  public readonly description =
    "Edits an existing local text file by replacing a specific string.";
  public readonly inputFormat =
    '{"file_path":"README.md","old_string":"old text","new_string":"new text","replace_all":false}';
  public readonly permission = "write" as const;

  public async run(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = editFileInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        output: `Invalid edit_file input: ${parsed.error.message}`,
      };
    }

    return this.editFile(parsed.data, context);
  }

  private async editFile(
    input: EditFileInput,
    context: ToolContext,
  ): Promise<ToolResult> {
    const resolvedPath = path.isAbsolute(input.file_path)
      ? input.file_path
      : path.join(context.cwd, input.file_path);

    let content: string;
    try {
      content = await fs.readFile(resolvedPath, "utf8");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown read error";
      return {
        ok: false,
        output: `Failed to read file before edit: ${message}`,
      };
    }

    if (!content.includes(input.old_string)) {
      return {
        ok: false,
        output: `Target text was not found in ${resolvedPath}`,
      };
    }

    const nextContent = input.replace_all
      ? content.split(input.old_string).join(input.new_string)
      : content.replace(input.old_string, input.new_string);

    await fs.writeFile(resolvedPath, nextContent, "utf8");

    return {
      ok: true,
      output: `Updated ${resolvedPath}`,
    };
  }
}
