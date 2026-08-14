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
- [Comparison with official presets](#comparison-with-official-presets)
- [Comparison with oh-my-openagent (OMO)](#comparison-with-oh-my-openagent-omo)
- [Installation](#installation)
- [Deploying & using the presets](#deploying--using-the-presets)
- [AI-assisted deployment prompt](#ai-assisted-deployment-prompt)
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

## Comparison with official presets

DSH ships four official presets. Here is how `sisyphus` / `sisyphus-oracle` relate to them:

| Capability | standard | code | cordis | minimal | **sisyphus** | **sisyphus-oracle** |
|---|---|---|---|---|---|---|
| Persona | short | short | long (two-plane) | fixed (`complete: true`) | ~500-line orchestrator protocol | read-only consultant |
| bash / pwsh | ✅ | ✅ | ✅ | persistent PTY | ✅ | ✅ (masked by restrict.js) |
| fs read/write | ✅ | ✅ | ✅ | fs-local | ✅ | read-only (restrict.js) |
| str_replace_editor | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| background jobs | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| goal | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| plan mode | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| compaction | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| skills | ✅ | ✅ | ✅ + authoring skill | ❌ | ✅ | ❌ |
| subagent delegation | ✅ | ✅ | ✅ | ❌ | ✅ + **6 role lanes** | ❌ |
| workflow / ralph | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| run_code (Code Mode) | ❌ | ✅ | ❌ | ❌ | ✅ (mode: both) | ❌ |
| tool-cordis (self-modify) | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| lsp | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| session recall | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| role lanes (explore/oracle/vision/librarian/metis/momus) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| registry-level read-only enforcement | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (restrict.js) |
| per-lane model config (lane-models.js) | ❌ | ❌ | ❌ | ❌ | ✅ | n/a |

**How to choose**:

- **standard** — clean baseline for everyday coding.
- **code** — same as standard, but batch multi-step work through `run_code`.
- **cordis** — when you want the agent to author/modify DSH presets itself (self-referential toolset + authoring skill).
- **minimal** — fixed prompt, two persistent tools, maximum determinism, no agent machinery.
- **sisyphus** — when you want orchestration: intent gating, six expert lanes, METIS→plan→MOMUS loop, parallel delegation, category routing. Superset of standard's tools plus LSP/session-recall/run_code/cordis.
- **sisyphus-oracle** — when you want consultation with a hard guarantee of zero side effects (registry-level tool masking).

---

## Comparison with oh-my-openagent (OMO)

`sisyphus` is a port of OMO's Sisyphus workflow to the DSH platform. It shares the orchestration *philosophy* but differs in *mechanisms*:

| Aspect | oh-my-openagent (opencode plugin) | DSH Sisyphus | Notes |
|---|---|---|---|
| Agent construction | dynamic (`createSisyphusAgent(model, availableAgents, tools, skills, categories)` — prompt varies by model family and injects live environment) | static persona (hand-written, model-agnostic) | DSH presets are declarative files; no runtime prompt generation |
| Delegation API | `task()` + `category` (8 categories) + `subagent_type` (explore/librarian/oracle/metis/momus) | `subagent` tool + 6 fixed lanes (explore/oracle/vision/librarian/metis/momus) | same role set, different carrier |
| Dynamic category routing | native `category` parameter selects model at call time | **workflow** script `agent(prompt, {provider, model})` — runtime override, `category-router.js` template | DSH equivalent implemented via workflow engine |
| Metis / Momus | pre-planning consultant + plan critic (expensive models) | ✅ ported as `subagent_metis` / `subagent_momus` lanes | planning loop: METIS → plan → MOMUS |
| Librarian | external reference agent (GitHub/Context7/Web) | ✅ ported as `subagent_librarian` lane (web_search) | |
| Vision | multimodal-looker | ✅ `subagent_vision` lane | |
| Skill injection | dynamic `availableSkills` injected into persona | static skill references + `tool-skill` | persona lists skill usage rules, not a live catalog |
| Session continuity | continuation session id | `send_message` on durable subagent id | equivalent |
| Parallel background exploration | `run_in_background` + `background_output` | `backgroundMode: continuable` + completion notice | equivalent |
| Workflow engine | no native equivalent (hyperplan = skill simulation) | **native `workflow` tool** (JS orchestration scripts) | DSH advantage |
| Ralph loop | no native equivalent | **native `ralph` tool** (self-referential loop) | DSH advantage |
| Self-modification | none | **`tool-cordis`** (inspect/define/run/stop/undefine live runtime) | DSH advantage |
| Code Mode | none | **`run_code`** (TypeScript SDK batch execution) | DSH advantage |
| Read-only guarantee | persona-only | **registry-level** (`restrict.js` masks tools from the catalog) | DSH advantage for sisyphus-oracle |
| License | SUL-1.0 | SUL-1.0 (derivative) | see LICENSE |

**What OMO has that DSH Sisyphus does not**:

- Dynamic prompt generation per model family (OMO bakes different prompt bodies for kimi/gpt/claude families).
- Live environment injection (persona literally lists the session's real available agents/tools/skills).
- Native `category` parameter on `task()` (DSH needs a workflow script for the equivalent).

**What DSH Sisyphus has that OMO does not**:

- Native `workflow` engine, `ralph` loop, `run_code`, `tool-cordis` self-modification.
- Registry-level read-only enforcement (restrict.js).
- Declarative preset files that install by copying a directory (no build step).

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

Stop and start your harness instance (however you normally restart DSH — the launcher command, a service manager, or the web UI's restart action). A fresh session will pick up the new presets.

---

## Deploying & using the presets

### Where the files must live

| File | Must be at |
|---|---|
| `sisyphus/` (whole directory) | `<DSH_HOME>\.agent-presets\sisyphus\` |
| `sisyphus-oracle/` (whole directory) | `<DSH_HOME>\.agent-presets\sisyphus-oracle\` |
| `skills/team-orchestration/` (whole directory) | `<DSH_HOME>\skills\team-orchestration\` |

`DSH_HOME` is the harness home directory (the launcher sets it; on this repo's reference machine it is `D:\DeepSeek Harness\home`). Keep the **whole directory**, not just the files inside — the preset directory carries its own `lane-models.js` and `restrict.js` siblings that the composition references by relative path.

### Making a preset the default

To make `sisyphus` the default preset for all new sessions, set it in `settings.yaml`:

```yaml
agent-presets:
  default: sisyphus
```

The value is read per session creation — no restart needed for this change alone. You can also keep the official default and pick a preset per session instead.

### Using the presets

- **Web UI**: open the preset picker when creating a new session; choose **Sisyphus** or **Sisyphus Oracle**.
- **API**: pass `"agentPreset": "sisyphus"` (or `"sisyphus-oracle"`) in `session.create`:

```powershell
$body = '{"type":"client-request","rpcId":"t","method":"session.create","payload":{"workspaceId":"<ws-id>","agentPreset":"sisyphus"}}'
Invoke-WebRequest -Uri "http://127.0.0.1:3080/api/session.create" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing
```

- **Switching a blank session**: a session that has not produced any turns yet can switch presets via `agentPreset.select` (a session that has run is locked to its preset).
- **Restart note**: changing `lane-models.js` (pinned lane models) or any file inside a preset directory requires a DSH restart — the composition is read at preset mount. `settings.yaml` changes (default preset, model provider) apply without restart.

### Post-deployment checklist

1. Both presets mount: create a session with each — expect `ok: true`.
2. Oracle session shows only read-only tools (see [Verification](#verification)).
3. Sisyphus session exposes all six lanes (`subagent_explore/oracle/vision/librarian/metis/momus`) plus `workflow`, `ralph`, `run_code`, `cordis_*`.
4. Lane models resolve: ask an oracle subagent to self-report `{{model}}` — should match your session model (or the `lane-models.js` pin).

---

## AI-assisted deployment prompt

If you want an AI coding assistant (Claude Code, opencode, Cursor, etc.) to deploy these presets for you, paste the prompt below. It is written to be self-contained: it tells the AI exactly what to copy, where, and how to verify — no further context needed.

### Prompt: deploy the presets

```text
Deploy the DSH Sisyphus presets to a DeepSeek Harness installation.

Context:
- The presets are in this repository: the `sisyphus/` and `sisyphus-oracle/`
  directories (each is an agent preset = a directory with agent.cordis.yml
  plus sibling files), and the `skills/team-orchestration/` directory
  (a DSH skill with a SKILL.md and references/).
- DSH_HOME is the harness home directory. On Windows it is typically
  D:\DeepSeek Harness\home; on Linux/macOS it is $HOME/.dsh. Find the real
  one by checking the launcher scripts for the DSH_HOME environment
  variable, or look for the `profiles/` and `sessions/` directories.

Steps:
1. Copy the whole `sisyphus/` directory to <DSH_HOME>\.agent-presets\sisyphus\
   (copy the directory itself, not just its files).
2. Copy the whole `sisyphus-oracle/` directory to
   <DSH_HOME>\.agent-presets\sisyphus-oracle\.
3. Copy the whole `skills/team-orchestration/` directory to
   <DSH_HOME>\skills\team-orchestration\.
4. Restart DSH (stop then start the harness using whatever restart
   procedure this deployment normally uses).

Verification (required, report the results):
- Create a session with agentPreset "sisyphus": expect ok:true and no
  "failed to mount" error.
- Create a session with agentPreset "sisyphus-oracle": expect ok:true.
- In the oracle session, prompt "List every tool name in your catalog" —
  the visible tools must be exactly: read, read_image, glob, grep, lsp,
  web_search, ask_user_question, schedule_create, schedule_delete,
  schedule_list. There must be NO write/edit/pwsh/mcp__* tools.
- In the sisyphus session, verify the six subagent lanes exist:
  subagent_explore, subagent_oracle, subagent_vision, subagent_librarian,
  subagent_metis, subagent_momus.

Constraints:
- Do NOT modify any file inside the preset directories after copying.
- Do NOT create a git repo, do not push anything.
- If a copy target already exists, report it and stop rather than
  overwriting.
```

### Prompt: verify an existing deployment

```text
Verify that the DSH Sisyphus presets are correctly deployed on this
DeepSeek Harness installation.

Check:
1. <DSH_HOME>\.agent-presets\sisyphus\ exists and contains
   agent.cordis.yml + lane-models.js (plus preset.yml).
2. <DSH_HOME>\.agent-presets\sisyphus-oracle\ exists and contains
   agent.cordis.yml + restrict.js (plus preset.yml).
3. <DSH_HOME>\skills\team-orchestration\ exists with SKILL.md and
   references/ (hyperplan.js, security-research.js,
   parallel-exploration.js, category-router.js).
4. The presets mount: call session.create with each preset id and report
   ok:true / any mount errors.
5. sisyphus-oracle tool restriction is active: in an oracle session, ask
   "List every tool name in your catalog" and confirm only read-only tools
   are visible (no write/edit/pwsh/mcp__*).
6. Lane model config is wired: check that sisyphus/agent.cordis.yml lane
   rows reference lane-models.js via agentOptions !!js expressions, and
   that lane-models.js has entries for all six lanes.

Report a pass/fail table for each check with the evidence you found.
```

> Tip: the second prompt is also useful after a DSH upgrade — preset
> compositions and `restrict.js` live in the harness home, so an upgrade
> that rewrites the app directory does not touch them, but re-verifying is
> cheap.

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
