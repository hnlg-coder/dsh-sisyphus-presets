# DSH Sisyphus Presets

DeepSeek Harness agent presets: **Sisyphus** (orchestrator) and **Sisyphus Oracle** (read-only consultant), ported from the oh-my-openagent (OMO) Sisyphus workflow.

[中文说明](README.zh-CN.md)

| Preset | Role | Summary |
|---|---|---|
| `sisyphus` | Orchestrator | Decomposes work, delegates to six expert subagent lanes in parallel, verifies results, and drives tasks to completion. |
| `sisyphus-oracle` | Read-only consultant | Diagnosis, architecture design, trade-off evaluation, security/perf review. Never edits anything. |

> This is a **derivative work** of oh-my-openagent's Sisyphus persona and workflow philosophy, licensed under SUL-1.0 (see [LICENSE](LICENSE)).

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Prerequisites](#prerequisites)
- [Model policy](#model-policy)
- [Sisyphus (orchestrator)](#sisyphus-orchestrator)
- [Sisyphus Oracle (read-only consultant)](#sisyphus-oracle-read-only-consultant)
- [Verification](#verification)
- [FAQ](#faq)
- [License](#license)

---

## Features

### Sisyphus — orchestrator with six expert delegation lanes

- **Intent gate**: classifies every request (explain / implement / investigate / evaluate / fix / refactor) before acting; never implements for a question.
- **Three modes**: Orchestrate (default), Advise (questions), Execute (trivial single-file work).
- **Six read-only, continuable subagent lanes** (background-capable, `send_message` continuation):

| Lane | Purpose | ToolFilter highlights |
|---|---|---|
| `subagent_explore` | Internal codebase search ("contextual grep") | read/glob/grep/lsp/session_* |
| `subagent_oracle` | High-IQ consultation for hard problems | + get_goal/job_list/job_output |
| `subagent_vision` | Image understanding (multimodal) | read_image/read/glob/grep |
| `subagent_librarian` | External reference search (docs/OSS) | web_search/read/glob/grep |
| `subagent_metis` | Pre-planning analysis: hidden intentions, ambiguities, AI failure points | read/glob/grep/lsp/session_* |
| `subagent_momus` | Adversarial plan review (PASS / PASS-WITH-FIXES / FAIL) | read/glob/grep/lsp/session_* |

- **Planning loop**: METIS → plan → MOMUS → revise → user approval (skipped for small tasks).
- **Parallel execution discipline**: fires 2–5 background subagents for multi-angle work; never duplicates delegated searches.
- **Validation loop**: grounding, lsp diagnostics, tests, build, manual QA, independent verification of delegated work.
- **Hard invariants**: no type-error suppression, no empty catch blocks, no destructive git, no fake citations/verification.
- **Category routing**: `workflow` + `team-orchestration` skill's `category-router.js` template routes units to different models at runtime by task domain (visual → multimodal, hard logic → heavy model, trivial → cheap model).

### Sisyphus Oracle — read-only consultant

- Read-only enforced at **three layers**:
  1. `restrict.js` plugin — listens on `agent/created`, applies `tools.restrict({allow: [...]})` on the agent's own scope, masking every inherited global tool (MCP github/playwright/blender, write/edit, bash/pwsh, schedule, goals, jobs).
  2. Persona hard constraints (never edit, never run side-effect commands).
  3. Host approval policy (`ask`).
- Tools kept: `read`, `read_image`, `glob`, `grep`, `lsp`, `web_search`, `ask_user_question` (+ harmless agent-scoped `schedule_*`).
- Model: follows the user's current session model (see [Model policy](#model-policy)).

---

## Installation

### 1. Install the presets

Copy each preset directory into your DSH user preset root (`$DSH_HOME/.agent-presets/`):

```powershell
# from this repository
Copy-Item .\sisyphus        <DSH_HOME>\.agent-presets\sisyphus        -Recurse
Copy-Item .\sisyphus-oracle <DSH_HOME>\.agent-presets\sisyphus-oracle -Recurse
```

The presets appear in the web UI's preset picker under the names "Sisyphus" and "Sisyphus Oracle".

### 2. Install the team-orchestration skill (recommended)

`sisyphus`'s persona references the `team-orchestration` skill for workflow templates (hyperplan, security research, parallel exploration, category routing):

```powershell
Copy-Item .\skills\team-orchestration <DSH_HOME>\skills\team-orchestration -Recurse
```

### 3. Restart DSH

```powershell
# your normal restart procedure
scripts\stop-dsh.ps1
scripts\start-dsh.ps1
```

---

## Prerequisites

| Requirement | Detail |
|---|---|
| DSH version | 0.1.0-rc.6 (built against; newer rc releases should work) |
| Host-plane services | `lsp` (LSP), `session-query` (session recall), `schedule`, `tool-web` (web_search) must be mounted in your host composition (`cordis.patch.yml`). These are standard in the shipped web profile. |
| Plugin versions | Profile plugins must match the app's main package version — see DSH's own AGENTS.md §1 for the `latest`-tag pitfall. |
| Model provider | Any provider configured in `settings.yaml` → `llm-pi-ai.providers` (see Model policy below). |

---

## Model policy

**Both presets do NOT pin a model.** All subagent lanes and the Oracle preset inherit the **parent agent's model route, snapshotted at session/agent creation** — the model selected when the session started (defaulting to your deployment default). This keeps the presets portable across deployments: no provider or model names are hardcoded, so they work on any DSH installation regardless of which LLM providers are configured.

> ⚠️ **Switching the session model mid-flight does NOT re-route subagents.** Subagents inherit `parent.options.model` at delegation time (verified: after `session.selectModel` to a heavier model, the parent's own requests switch but already-delegated lanes keep the creation-time model). The Oracle preset's top-level agent *does* follow a session switch (its requests resolve the current session model); its subagent lanes do not.

### Lane model resolution priority

```
1. lane-models.js pinned { provider, model }   ← explicit per-lane override
2. otherwise: parent agent's model at creation  ← default (session's model when session started)
```

### Customize per-lane models — edit `lane-models.js`, no YAML editing

Each lane's model is resolved from `sisyphus/lane-models.js` (a plain JS module that travels with the preset). `null` = inherit the session model (default); `{ provider, model }` = pin that lane. Edit the file, then restart DSH:

```js
// sisyphus/lane-models.js
module.exports = {
  explore:   null,                                                    // inherit
  oracle:    { provider: 'deepseek-official', model: 'deepseek-v4-pro' },  // pinned example
  vision:    { provider: 'opencode-go', model: 'mimo-v2.5' },         // read_image needs multimodal
  librarian: null,
  metis:     null,
  momus:     null,
};
```

- `provider` must be a key in your `settings.yaml` → `llm-pi-ai.providers`.
- The six lanes in `agent.cordis.yml` read their entry from this file via the loader's `!!js` + `createRequire` mechanism — you never edit the YAML structure.
- Changing a pinned lane requires a DSH restart (config is read at preset mount).

> ⚠️ **Vision lane caveat**: `read_image` only works when the routed model declares image input. If the session model is text-only, either switch the session to an image-capable model or pin `subagent_vision` via `lane-models.js` to a multimodal model.

### Runtime category routing (workflow)

For multi-domain tasks, the `workflow` tool's `agent(prompt, { provider, model })` supports **runtime model overrides**. The `team-orchestration` skill ships `references/category-router.js` — a template that routes each unit to the model its category deserves:

| category | model |
|---|---|
| `visual-engineering` | mimo-v2.5 (multimodal) |
| `ultrabrain` / `deep` | deepseek-v4-pro (heavy reasoning only) |
| `artistry` / `writing` / `quick` / `unspecified-low` | deepseek-v4-flash |
| `unspecified-high` / unset / `inherit` | current session model |

---

## Sisyphus (orchestrator) — what it does

- **Intent gate** — classifies before acting (explain/implement/investigate/evaluate/fix/refactor).
- **Three operating modes** — Orchestrate (default), Advise (questions), Execute (trivial single-file work).
- **Six expert delegation lanes** — all read-only, all continuable (background-capable, durable subagent id, `send_message` to continue, completion notice on settle).
- **Planning loop** — METIS → plan → MOMUS → revise → user approval (skipped for small tasks).
- **Parallel execution discipline** — fires 2–5 background subagents for multi-angle work; never duplicates delegated searches.
- **Validation loop** — grounding, lsp diagnostics, tests, build, manual QA, independent verification of delegated work.
- **Hard invariants** — no type-error suppression, no empty catch blocks, no destructive git, no fake citations/verification, never deliver while a consulted subagent is still running.

## Sisyphus Oracle (read-only consultant) — what it does

- Read-only enforced at three layers:
  1. `restrict.js` plugin — listens on `agent/created`, applies `tools.restrict({allow: [...]})` on the agent's own scope, masking every inherited global tool (MCP github/playwright/blender, write/edit, bash/pwsh, schedule, goals, jobs).
  2. Persona hard constraints (never edit, never run side-effect commands).
  3. Host approval policy (`ask`).
- Tools kept: `read`, `read_image`, `glob`, `grep`, `lsp`, `web_search`, `ask_user_question` (+ harmless agent-scoped `schedule_*`).
- Model: follows the current session model (switchable at any time).

---

## Verification

```powershell
# 1) Both presets mount (ok: true)
$body = '{"type":"client-request","rpcId":"t","method":"session.create","payload":{"workspaceId":"<ws-id>","agentPreset":"sisyphus"}}'
Invoke-WebRequest -Uri "http://127.0.0.1:3080/api/session.create" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing
# repeat with agentPreset "sisyphus-oracle"

# 2) Oracle session exposes no mutating tools
#    prompt: "List every tool name in your catalog" → should show only
#    read/read_image/glob/grep/lsp/web_search/ask_user_question/schedule_*
```

---

## FAQ

**Q: Why do subagents keep using the old model after I switch the session model?**
A: Subagents inherit the parent agent's model route **snapshotted at session/agent creation** (`parent.options.model`). Switching the session model only affects the parent's own future requests. To change lane models: open a new session, or edit `lane-models.js`, or pass `{provider, model}` in a workflow `agent()` call.

**Q: I use a different LLM provider than the examples. What do I change?**
A: Nothing, for default (inherit) behavior — lanes follow the session model. If you pin lanes, use your own provider key from `settings.yaml → llm-pi-ai.providers`.

**Q: Does the Oracle preset really never modify anything?**
A: Yes. `restrict.js` masks write/edit/bash/pwsh and all MCP tools from the tool catalog at the registry level, plus persona constraints and the host approval policy (`ask`). Verified end-to-end: a prompt attempting `write` gets "no such tool exists in my available function set".

**Q: Can I add my own lane?**
A: Yes. Copy any lane block in `sisyphus/agent.cordis.yml`, give it a unique `toolName` and `id`, add a matching entry to `lane-models.js`, and (optionally) a `toolFilter` allow-list.

**Q: Do I need the `team-orchestration` skill?**
A: Only for the workflow templates (hyperplan, security research, parallel exploration, category routing). The six subagent lanes work without it.

---

## License

SUL-1.0 (Sustainable Use License v1.0) — derivative of oh-my-openagent (© YeonGyu-Kim), which is itself licensed under SUL-1.0. See [LICENSE](LICENSE) for the full terms.

Non-commercial/personal use is free. Commercial use requires separate authorization. Redistribution must retain this notice and the original license terms.
