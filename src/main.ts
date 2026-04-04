import "dotenv/config";

import { render } from "ink";
import React from "react";

import { Repl } from "./app/repl.js";

const config = {
  baseUrl: process.env.DEV_AGENT_BASE_URL ?? "http://127.0.0.1:11434/v1",
  apiKey: process.env.DEV_AGENT_API_KEY ?? "ollama",
  model: process.env.DEV_AGENT_MODEL ?? "qwen2.5-coder:7b",
};

render(React.createElement(Repl, { config, cwd: process.cwd() }));
