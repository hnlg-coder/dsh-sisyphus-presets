/**
 * Read-only tool restriction for the sisyphus-oracle preset.
 *
 * Applies an allow-list to every live agent created on THIS preset (listened
 * on `agent/created`), keeping only the read-only tools below visible.
 *
 * WHY LISTEN ON agent/created INSTEAD OF RESTRICTING IN THE PRESET BODY:
 * `tools.restrict()` validates the filter against the calling scope's
 * RESTRICTABLE names — the tools that scope INHERITS (global layer +
 * ancestor layers), never its own. Called from a preset row, the preset's
 * own tools (read/glob/grep/lsp/...) are that scope's OWN layer, so they
 * cannot be named in the filter ("unknown global tool read") — and an empty
 * allow-list would strip them too, because from a session agent's view the
 * preset layer is an ancestor (inherited), not self.
 *
 * Called from the agent's own scoped context (agent.ctx, own = the agent),
 * the preset's tools ARE inherited, so they can be allow-listed by name,
 * and the mask lands on that agent alone. This mirrors how the delegation
 * lanes (`subagent_explore`/`subagent_oracle` toolFilter) work: the child
 * restricts from its own scope against the inherited preset tools.
 *
 * Effect for a sisyphus-oracle session: read/read_image/glob/grep/lsp/
 * web_search/ask_user_question stay visible; write/edit (preset layer),
 * bash/pwsh, and every host-plane global — github/playwright/blender MCP
 * servers, goals, jobs — are masked out, including tools that register
 * AFTER the mask (allow masks exclude later names). The schedule_* tools
 * remain visible because dsh-schedule registers them directly into the
 * agent's own layer, which no restriction can remove; they are harmless
 * session-local reminders and the persona never calls them.
 *
 * Cordis plugin name.
 */
const name = "tool-restrict";

/**
 * Required services: the agents registry (agent/created events) and the
 * agent-presets roster (to recognize agents composed on this preset).
 */
const inject = ["agents", "agentPresets"];

/** The only tools a read-only consultant keeps. */
const READ_ONLY_ALLOW = [
	"read",
	"read_image",
	"glob",
	"grep",
	"lsp",
	"web_search",
	"ask_user_question"
];

/**
 * Apply the allow-list to every root agent created on this preset.
 * @param ctx - the mounting composition's scope context (a preset's standing scope).
 */
function apply(ctx) {
	const stop = ctx.on("agent/created", ({ agent }) => {
		try {
			if (ctx.agentPresets.composedPreset(agent.ctx) !== "sisyphus-oracle") return;
			agent.ctx.tools.restrict({ allow: READ_ONLY_ALLOW });
		} catch (error) {
			ctx.logger.warn(`[tool-restrict] failed for agent ${agent.id}: ${String(error)}`);
		}
	});
	ctx.effect(() => stop, "tool-restrict lifecycle");
}

export { apply, inject, name };
