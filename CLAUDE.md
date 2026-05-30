# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AgentHub is a Tauri v2 desktop app for managing AI coding agents (Claude Code, Codex, Gemini CLI, etc.) across multiple projects. It provides a GUI to configure providers, MCP servers, skills, hooks, and permissions, then writes config files to disk and launches agents in new console windows.

## Build & Dev Commands

```bash
# Frontend dev server (Vite on port 1420)
npm run dev

# Tauri dev (builds Rust + launches frontend dev server)
npm run tauri dev

# Build production bundle
npm run tauri build

# Type-check frontend only
npx tsc --noEmit

# Build Rust backend only
cd src-tauri && cargo build
```

There are no tests configured in this project.

## Architecture

**Tauri v2 app**: Rust backend + React frontend, communicating via `invoke()` IPC.

### Frontend (`src/`)

- **No router** — navigation is state-driven via `useAppStore` hook (page, activeProjectId, detailTab)
- **State management**: `useAppStore` in `src/hooks/useAppStore.ts` is the single source of truth. It holds projects, configs, providers, and all UI state. Data persists to `localStorage` via `loadFromStorage`/`saveToStorage` helpers in `types.ts`
- **Config serialization**: Two parallel modules exist — `src/configWriter.ts` and `src/lib/project-config.ts`. Both convert `ProjectConfig` → `ProjectConfigInput` for the Rust backend. `project-config.ts` also has `writeConfigSilent` for auto-save. Prefer `project-config.ts` for new code.
- **i18n**: Custom system in `src/i18n.tsx` with 5 locales (`zh-CN`, `zh-TW`, `en`, `ja`, `ko`). Translation files in `src/locales/`. Access via `t()` function from `I18nContext`.
- **Components**: Section components (`AgentSection`, `ProviderSection`, `McpSection`, `SkillsSection`) handle one detail tab each. `ProjectDetailTabs` exports `ClaudeMdSection`, `PermissionsSection`, `HooksSection`.

### Backend (`src-tauri/src/`)

Rust modules, each exposing `#[tauri::command]` functions registered in `lib.rs`:

- **`config.rs`**: Reads/writes Claude Code config files — `.claude/settings.json`, `.claude/settings.local.json`, `CLAUDE.md`, `.mcp.json`, and global `~/.claude/settings.json`. Merges with existing content rather than overwriting.
- **`agent.rs`**: Spawns agent processes (currently only `claude-code`). Stores the child process in `AgentChild` managed state (Mutex-wrapped). On Windows, launches with `CREATE_NEW_CONSOLE` flag so the interactive CLI is visible.
- **`cc_switch.rs`**: Reads provider data from the CC Switch SQLite database at `~/.cc-switch/cc-switch.db` (read-only). Extracts base_url, api_key, model from the `settings_config` JSON field.
- **`commands.rs`**: Misc commands — project init (downloads skills from skillhub API), folder ops, `init_agent` (runs `claude /init` then `claude /self-improving-agent`), API connectivity test.
- **`types.rs`**: Shared Rust structs for IPC — `ProjectConfigInput`, `McpServerInput`, `HookInput`, `SkillInput`, `CcSwitchProvider`, `AgentChild`, `InitStep`.

### Data Flow

1. User edits config in frontend → `updateConfig()` saves to localStorage + debounced auto-save to disk via `writeConfigSilent`
2. `saveConfig` button does an explicit write via `tauri.writeProjectConfig()`
3. `startAgent` spawns the agent CLI in a new console window with `--model`, `--permission-mode`, `--settings`, `--mcp-config` flags
4. `openProject` reads existing config from disk and merges into state (CLAUDE.md, env vars, permissions, MCP servers, hooks)

### Config Files Written

- `.claude/settings.json` — permissions, MCP servers, hooks
- `.claude/settings.local.json` — env vars (API key, base URL, models)
- `CLAUDE.md` — project instructions
- `.mcp.json` — MCP server config (for tools that read this format)
- `~/.claude/settings.json` — global settings (advisor model)

## Key Dependencies

- **Rust**: `tauri` 2, `rusqlite` (bundled SQLite for CC Switch DB), `dirs`, `serde`/`serde_json`
- **Frontend**: `@tauri-apps/api` 2, `lucide-react` (icons), React 19, Vite 6
- No CSS framework — all styles in `src/styles.css`

## Coding Standards

Based on the project's 通用编码规范 v1.0. This project uses TypeScript (frontend) and Rust (backend).

### File Limits

| Metric | TypeScript | Rust |
|---|---|---|
| File line limit | 300 | 500 |
| Function line limit | 50 | 60 |
| Function param limit | 4 (use object above) | 4 (use struct above) |
| Nesting depth limit | 3 levels | 4 levels |
| Cyclomatic complexity | ≤ 10 | ≤ 10 |
| Imports per file | ≤ 20 | ≤ 20 |
| Line length | ≤ 100 chars | ≤ 100 chars |

When over limit: file → split module, function → extract sub-function, nesting → early return / guard clause, params → options object / struct.

### Naming

| Element | TypeScript | Rust |
|---|---|---|
| Variables / functions | `camelCase` | `snake_case` |
| Constants | `UPPER_SNAKE` | `UPPER_SNAKE` |
| Types / interfaces / structs | `PascalCase` | `PascalCase` |
| Files | `kebab-case.ts` | `snake_case.rs` |
| Enums | `PascalCase` values | `PascalCase` values |
| Booleans | `is`/`has`/`can` prefix | `is_`/`has_` prefix |

- No single-letter variables (except `i`/`j`/`k` in loops)
- No abbreviations: `usr` → `user`, `cfg` → `config`, `btn` → `button`
- Functions start with verb: `get`/`set`/`create`/`delete`/`update`/`is`/`has`
- Collections use plural: `users`, not `userList`
- Avoid negative booleans: `isDisabled` not `isNotEnabled`
- No `I` prefix on interfaces (TS), no `Impl` suffix on implementations

### Code Style

| Style | TypeScript | Rust |
|---|---|---|
| Indent | 2 spaces | 4 spaces |
| Quotes | Single | Double |
| Semicolons | No | Yes |
| Trailing commas | Yes | Yes |
| Equality | `===` | `==` |
| Formatter | Prettier | rustfmt |
| Linter | ESLint | clippy |

- All files end with a trailing newline
- No trailing whitespace
- Spaces around operators: `a + b` not `a+b`
- 1 blank line between functions, 1 blank line between logical paragraphs

### Error Handling

- **Never swallow errors** — empty `catch {}` / `_ = mightFail()` is forbidden
- **Errors must include context** — "what operation, on what, why"
- **Handle at the right layer** — don't swallow in lower layers, don't blindly re-throw in upper layers
- **Distinguish business vs system errors** — validation (4xx) vs infrastructure (5xx)
- **Don't use errors for flow control** — "not found" is a normal branch, not an error

### Comments & Docs

- Comments explain **WHY**, not WHAT
- All exported functions/types must have doc comments (JSDoc / `///` doc comments)
- `TODO` must include info: `// TODO(name): description + #issue`
- Delete commented-out code — Git history preserves it
- Hacks and workarounds must have comments explaining the reason

### Security

- No hardcoded API keys, passwords, or tokens — use env vars or secret management
- No `eval()` or dynamic code execution
- SQL must be parameterized — no string concatenation
- User input must be validated and escaped
- Sensitive data must not appear in logs

### Git (Conventional Commits)

Format: `<type>(<scope>): <description>`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

- One commit per concern — don't mix 3 features in one commit
- No committing sensitive files (.env, keys, large binaries)
- Use present tense: "add feature" not "added feature"

### Anti-Patterns to Avoid

- **God Object** — one file/class doing everything → split to single-responsibility modules
- **Magic Number** — `if (status === 3)` → `if (status === Status.ACTIVE)`
- **Callback Hell** — use async/await
- **Copy-Paste Code** — extract shared function
- **Premature Abstraction** — abstract when you have 3 similar implementations, not 1
- **Global Mutable State** — centralized state management, unidirectional data flow
- **String Typing** — `type: 'user'` → use enum / union type
- **Debug `console.log`** — use proper logger, remove before commit
- **`any` / `interface{}` escape hatch** — define proper types

## Platform Notes

- Windows-only: `open_folder` uses `explorer.exe`, agent launch uses `CREATE_NEW_CONSOLE`, skill downloads use `powershell.exe`, skillhub checks use `wsl.exe`
- CC Switch integration reads a SQLite DB from the user's home directory
