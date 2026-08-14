---
name: team-orchestration
description: Team-mode orchestration templates for the workflow tool - hyperplan-style hostile cross-review, security-research-style hunter/PoC audit, parallel exploration, and category-routed dynamic model dispatch. Use when the user asks for a review board, multi-angle adversarial analysis, a security audit with proof-of-concept validation, parallel investigation across many independent angles, or runtime model routing by task domain.
whenToUse: user asks for hyperplan, hostile review, reviewer board, security audit/research with PoCs, parallel exploration, multi-expert analysis, red-team review, category routing, dynamic model selection, route by task type.
---

# Team Orchestration via workflow

Run adversarial or fan-out team patterns with the `workflow` tool. Each template below is a plain-JS script body for the `workflow` tool's `script` parameter - copy it, adapt the prompts, and pass `meta`/`args` separately.

## Script API contract (enforced by the engine)

- Top-level `await` allowed; end with `return <json-serializable value>`.
- `agent(prompt, opts?)` - one subagent to completion. With `opts.schema` (object-rooted JSON Schema using ONLY `type`/`properties`/`required`/`additionalProperties`/`items`/`enum`/`const`/`oneOf`) resolves to the validated object; without it resolves to final text. Resolves `null` on child failure - always `.filter(Boolean)`. Other opts: `label`, `phase`, independent `provider`/`model` overrides.
- `pipeline(items, ...stages)` - each item through stages independently, no barrier.
- `parallel(thunks)` - run zero-argument functions concurrently, await ALL (barrier).
- `phase(title)`, `log(message)`, `args` (the tool call's args input, verbatim).
- No filesystem/network/timers/Node APIs - the agents do the work, the script only coordinates.
- Misused hooks throw and kill the script. Concurrency/total-agent caps apply.

## Templates

| Template | File | Use case |
|---|---|---|
| Hyperplan | `references/hyperplan.js` | Adversarial review board: N hostile specialists critique a plan/design from disjoint angles, lead synthesizes a final decision-complete plan. |
| Security research | `references/security-research.js` | 3 hunters find vulnerabilities in parallel, 2 PoC engineers prove exploitability, lead classifies root causes and calibrates severity. |
| Parallel exploration | `references/parallel-exploration.js` | Fan out 2-5 independent investigation angles, then merge findings into one structured report. |
| Category router | `references/category-router.js` | Dynamic model routing by task domain: each unit of work runs on the provider/model its category deserves (visual -> multimodal, hard logic -> pro, trivial -> flash). The DSH equivalent of opencode's category system. |

### Category router details

`agent()`'s `provider`/`model` opts are RUNTIME overrides - each subagent is routed to the model the script chooses, unlike the fixed `subagent_*` lanes which pin one model per tool. Route table (keep in sync with `settings.yaml` `llm-pi-ai.providers`):

| category | model |
|---|---|
| `visual-engineering` | mimo-v2.5 (multimodal) |
| `ultrabrain` / `deep` | deepseek-v4-pro (仅真硬推理) |
| `artistry` / `writing` / `quick` / `unspecified-low` | deepseek-v4-flash |
| `unspecified-high` | **继承会话模型**(未归类任务不配升 pro) |
| 未传 / `inherit` / 未知 | **当前会话模型**(不传 provider/model,子代理继承父路由——用户正在用的模型,不会静默升级或降级) |

Cost policy: pro 只留给真正需要深度推理的 ultrabrain/deep;生成型(artistry/writing)与琐碎任务走 flash;无法归类的兜底走继承。

Call it with `args = { task, units: [{ id, prompt, category }], mergePrompt? }`; the report includes each unit's actual `routedTo` (`"inherit:session"` for uncategorized units) for verification.

## Usage notes

1. `meta.name` short kebab-case, `meta.description` one line; `meta.phases` optional (match `phase()` calls by exact title).
2. Keep reviewer prompts mutually blind - each reviewer sees only the artifact plus its own angle, never other reviews; the lead sees all reviews only after they are frozen.
3. For a security audit, each hunter returns `{kind:"finding"|"clean", ...}`; PoC engineers attempt reproduction only after hunters report; severity calibration happens in the final lead step.
4. If a child fails, `agent()` returns `null` - filter before synthesis so a failed lane degrades gracefully instead of poisoning the report.
