import React from "react";

import { App } from "./components/App.js";

import type { ProviderConfig } from "../providers/types.js";

type ReplProps = {
  config: ProviderConfig;
  cwd: string;
};

export function Repl({ config, cwd }: ReplProps) {
  return <App config={config} cwd={cwd} />;
}
