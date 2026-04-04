import { getDefaultPermissionResolution } from "./defaults.js";

import type {
  PermissionDecision,
  PermissionMode,
  PermissionRequest,
  PermissionResolution,
} from "./types.js";

export class PermissionEngine {
  private readonly sessionRules = new Map<string, PermissionDecision>();

  public constructor(private readonly mode: PermissionMode = "default") {}

  public evaluate(request: PermissionRequest): PermissionResolution {
    const remembered = this.sessionRules.get(request.toolName);
    if (remembered) {
      return remembered;
    }

    return getDefaultPermissionResolution(this.mode, request);
  }

  public rememberSessionDecision(
    request: PermissionRequest,
    decision: PermissionDecision,
  ): void {
    this.sessionRules.set(request.toolName, decision);
  }

  public getMode(): PermissionMode {
    return this.mode;
  }
}
