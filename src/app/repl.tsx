import React from "react";

import { App } from "./components/App.js";

import type { ProviderConfig } from "../providers/types.js";
import type { SessionSnapshot, SessionStore } from "../storage/session-store.js";

type ReplProps = {
  config: ProviderConfig;
  cwd: string;
  sessionStore: SessionStore;
  initialSession: SessionSnapshot;
  resumed: boolean;
};

export function Repl({ config, cwd, sessionStore, initialSession, resumed }: ReplProps) {
  return (
    <App
      config={config}
      cwd={cwd}
      sessionStore={sessionStore}
      initialSession={initialSession}
      resumed={resumed}
    />
  );
}
