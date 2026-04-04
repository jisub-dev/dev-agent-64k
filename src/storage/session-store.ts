import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { ChatMessage } from "../providers/types.js";

export type SessionSnapshot = {
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export class SessionStore {
  public constructor(private readonly cwd: string) {}

  public createSessionId(): string {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${stamp}-${randomUUID().slice(0, 8)}`;
  }

  public async loadLatest(): Promise<SessionSnapshot | null> {
    const dir = this.getSessionsDir();
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return null;
    }

    const candidates = entries.filter((entry) => entry.endsWith(".json"));
    if (candidates.length === 0) {
      return null;
    }

    const sorted = await Promise.all(
      candidates.map(async (entry) => {
        const filePath = path.join(dir, entry);
        const stat = await fs.stat(filePath);
        return {
          filePath,
          mtimeMs: stat.mtimeMs,
        };
      }),
    );

    sorted.sort((left, right) => right.mtimeMs - left.mtimeMs);
    const latest = sorted[0];
    if (!latest) {
      return null;
    }

    return this.readSnapshot(latest.filePath);
  }

  public async save(snapshot: SessionSnapshot): Promise<void> {
    const dir = this.getSessionsDir();
    await fs.mkdir(dir, { recursive: true });

    const filePath = this.getSessionFilePath(snapshot.sessionId);
    const payload: SessionSnapshot = {
      ...snapshot,
      messages: snapshot.messages.map((message) => ({ ...message })),
    };
    await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  public createEmptySnapshot(sessionId: string): SessionSnapshot {
    const now = new Date().toISOString();
    return {
      sessionId,
      cwd: this.cwd,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
  }

  private async readSnapshot(filePath: string): Promise<SessionSnapshot | null> {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as SessionSnapshot;
      if (!parsed || !Array.isArray(parsed.messages)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private getSessionsDir(): string {
    return path.join(this.cwd, ".dev-agent", "sessions");
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.getSessionsDir(), `${sessionId}.json`);
  }
}
