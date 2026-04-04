import { describe, expect, it } from "vitest";

import { tryParseAgentAction } from "../src/core/action-schema.js";

describe("tryParseAgentAction", () => {
  it("parses shorthand tool actions where kind is the tool name", () => {
    const parsed = tryParseAgentAction(`{
      "kind": "write_file",
      "file_path": "README.md",
      "content": "hello"
    }`);

    expect(parsed).toEqual({
      kind: "tool_call",
      tool_name: "write_file",
      tool_input: {
        file_path: "README.md",
        content: "hello",
      },
    });
  });

  it("parses fenced json tool actions", () => {
    const parsed = tryParseAgentAction(`\`\`\`json
{
  "kind": "tool_call",
  "tool_name": "read_file",
  "tool_input": { "file_path": "README.md" }
}
\`\`\``);

    expect(parsed).toEqual({
      kind: "tool_call",
      tool_name: "read_file",
      tool_input: {
        file_path: "README.md",
      },
    });
  });
});
