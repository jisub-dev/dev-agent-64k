import "dotenv/config";

import { render } from "ink";
import React from "react";

import { Repl } from "./app/repl.js";
import { SessionStore } from "./storage/session-store.js";

const config = {
  baseUrl: process.env.DEV_AGENT_BASE_URL ?? "http://127.0.0.1:11434/v1",
  apiKey: process.env.DEV_AGENT_API_KEY ?? "ollama",
  model: process.env.DEV_AGENT_MODEL ?? "qwen2.5-coder:7b",
};

async function main() {
  const cwd = process.cwd();
  const sessionStore = new SessionStore(cwd);
  const resumeLatest = process.argv.includes("--resume-latest");
  const resumedSession = resumeLatest ? await sessionStore.loadLatest() : null;
  const initialSession =
    resumedSession ?? sessionStore.createEmptySnapshot(sessionStore.createSessionId());

  render(
    React.createElement(Repl, {
      config,
      cwd,
      sessionStore,
      initialSession,
      resumed: resumedSession !== null,
    }),
  );
}

await main();
