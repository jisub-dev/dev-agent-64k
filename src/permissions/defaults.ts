import type {
  PermissionMode,
  PermissionRequest,
  PermissionResolution,
} from "./types.js";

export function getDefaultPermissionResolution(
  mode: PermissionMode,
  request: PermissionRequest,
): PermissionResolution {
  if (mode === "bypass") {
    return "allow";
  }

  if (mode === "accept_edits") {
    return request.toolPermission === "execute" ? "ask" : "allow";
  }

  if (request.toolPermission === "read") {
    return "allow";
  }

  return "ask";
}
