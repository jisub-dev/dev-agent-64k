import fg from "fast-glob";
import path from "node:path";

import { z } from "zod";

import type { Tool, ToolContext, ToolResult } from "./tool.js";

const globInputSchema = z.object({
  pattern: z.string().min(1),
  cwd: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

type GlobInput = z.infer<typeof globInputSchema>;

export class GlobTool implements Tool {
  public readonly name = "glob";
  public readonly description =
    "Finds files using a glob pattern relative to the current working directory.";
  public readonly inputFormat = '{"pattern":"src/**/*.ts","limit":50}';
  public readonly permission = "read" as const;

  public async run(input: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = globInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        output: `Invalid glob input: ${parsed.error.message}`,
      };
    }

    return this.findMatches(parsed.data, context);
  }

  private async findMatches(
    input: GlobInput,
    context: ToolContext,
  ): Promise<ToolResult> {
    const workingDirectory = input.cwd
      ? path.isAbsolute(input.cwd)
        ? input.cwd
        : path.join(context.cwd, input.cwd)
      : context.cwd;

    const limit = input.limit ?? 100;
    const matches = await fg(input.pattern, {
      cwd: workingDirectory,
      onlyFiles: false,
      dot: true,
      unique: true,
      suppressErrors: true,
    });

    if (matches.length === 0) {
      return {
        ok: true,
        output: `No matches for pattern "${input.pattern}" in ${workingDirectory}`,
      };
    }

    const sliced = matches.slice(0, limit);
    const lines = sliced.map((match) => path.join(workingDirectory, match));
    const trailing =
      matches.length > sliced.length
        ? `\n... (${matches.length - sliced.length} more matches)`
        : "";

    return {
      ok: true,
      output: `Glob results for "${input.pattern}" in ${workingDirectory}:\n${lines.join("\n")}${trailing}`,
    };
  }
}
