# Dev-Agent

`dev-agent` is a local CLI coding agent prototype for a closed-network environment.

It runs in the terminal, connects to an OpenAI-compatible model endpoint such as Ollama, and can read files, edit files, search the workspace, run shell commands, and ask for permission before risky actions.

This repository is the current higher-context baseline that was built while exploring a Claude Code style workflow. It works today, but the long-term direction is shifting toward a lighter, more deterministic CLI agent for smaller local models.

## Related Article

- Project write-up: [폐쇄망 환경에서 로컬 LLM 코딩 에이전트 파일럿 구축기](https://memorysaver.tistory.com/31)

## Goals

- Validate an internal coding agent pilot in a closed-network environment
- Keep the interaction model simple: terminal-first, local workspace tools, explicit approvals
- Support practical backend developer tasks such as reading files, applying small edits, and running tests

## Current Features

- Interactive Ink-based terminal UI
- OpenAI-compatible provider for Ollama-style endpoints
- File tools
  - `read_file`
  - `write_file`
  - `edit_file`
  - `glob`
- Shell tool
  - `bash`
- Permission flow
  - read operations are allowed by default
  - edit and execute operations ask for approval unless bypassed
- Local session persistence
  - sessions are stored under `.dev-agent/sessions`
  - latest session can be resumed with `--resume-latest`
- Regression tests for parser, query loop, and session storage

## Current Limitations

- The agent loop still assumes a relatively capable model compared with very small local models
- Tool selection is still partially model-driven, so weaker models can produce unstable behavior
- `bash` is not yet constrained by a strong allowlist policy
- Session storage is still transcript-oriented, not summary-oriented
- This is not a Claude Code clone and should not be evaluated as parity software

## Requirements

- Node.js `22+`
- A reachable OpenAI-compatible model endpoint
- Recommended current test setup:
  - Ollama server on Ubuntu
  - `qwen2.5-coder:7b`

## Environment

Copy `.env.example` to `.env` and adjust it for your server.

Example:

```bash
DEV_AGENT_BASE_URL=http://192.168.200.112:11434/v1
DEV_AGENT_API_KEY=ollama
DEV_AGENT_MODEL=qwen2.5-coder:7b
```

## Install

```bash
npm install
```

## Run

Start a new session:

```bash
npm run dev
```

Resume the latest session:

```bash
npm run dev -- --resume-latest
```

Production-style local run after build:

```bash
npm run build
npm run start
```

## Test

```bash
npm run typecheck
npm test
```

## Example Prompts

- `README.md를 읽고 초반만 보여줘`
- `src 폴더에서 ts 파일 찾아줘`
- `tmp/hello.txt 파일 만들고 hello 라고 써줘`
- `README.md에서 scaffold를 prototype으로 바꿔줘`
- `현재 작업 디렉터리에서 pwd 실행해줘`

## Project Structure

```text
src/
  app/            Ink UI and terminal interaction
  core/           query loop, prompts, action parsing
  permissions/    permission decisions and defaults
  providers/      OpenAI-compatible provider abstraction
  storage/        session persistence
  tools/          read/write/edit/glob/bash tools
test/             regression tests
```

## Recommended Evaluation Scope

This project is best evaluated as a pilot for:

- repository inspection
- small file edits
- config updates
- test execution
- log reading and summarization

It is not yet the right benchmark for:

- large multi-step autonomous refactors
- long-context coding agents
- complex agent orchestration across many tools

## Next Direction

The planned redesign is to move from a more open-ended agent loop to a lightweight pipeline-based CLI agent:

- `inspect`
- `patch`
- `run`

In that direction, intent routing will be more rule-based, prompts will be shorter, and the model will be used for narrower tasks such as summarization and patch generation.
