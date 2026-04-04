import type { ToolPermission } from "../tools/tool.js";

export type PermissionMode = "default" | "accept_edits" | "bypass";
export type PermissionDecision = "allow" | "deny";
export type PermissionResolution = "allow" | "deny" | "ask";
export type PermissionMemoryScope = "once" | "session";

export type PermissionRequest = {
  toolName: string;
  toolPermission: ToolPermission;
  summary: string;
};
