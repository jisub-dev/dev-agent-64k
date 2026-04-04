# Dev-Agent

`dev-agent` is a local CLI coding agent scaffold.

Current status:

- Node.js + TypeScript project scaffold
- Ink-based REPL shell
- provider and message types
- ready for Ollama OpenAI-compatible wiring

## Requirements

- Node.js 22+
- Ubuntu Ollama server reachable from this machine

## Environment

Copy `.env.example` to `.env` and adjust as needed.

Key variables:

- `DEV_AGENT_BASE_URL`
- `DEV_AGENT_API_KEY`
- `DEV_AGENT_MODEL`

## Commands

```bash
npm install
npm run dev
```

The next implementation step is wiring the provider so user input calls the Ubuntu Ollama endpoint.
