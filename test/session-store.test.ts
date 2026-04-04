import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { SessionStore } from "../src/storage/session-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("SessionStore", () => {
  it("saves and reloads the latest session snapshot", async () => {
    const cwd = await createTempDir();
    const store = new SessionStore(cwd);
    const snapshot = store.createEmptySnapshot(store.createSessionId());
    snapshot.messages.push({
      role: "user",
      content: "session smoke test",
    });

    await store.save(snapshot);
    const loaded = await store.loadLatest();

    expect(loaded?.sessionId).toBe(snapshot.sessionId);
    expect(loaded?.messages).toEqual(snapshot.messages);
  });
});

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dev-agent-test-"));
  tempDirs.push(directory);
  return directory;
}
