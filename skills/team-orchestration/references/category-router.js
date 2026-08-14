// category-router.js - dynamic model routing by task category.
// The DSH equivalent of opencode's category system: one workflow script that
// dispatches each unit of work to a provider/model chosen at RUNTIME by the
// task's domain, instead of being pinned to one lane's fixed route.
//
// Usage: workflow tool, script = this body (adapted), args = {
//   task,            // the overall task description
//   units: [{       // one unit of work per item
//     id,            // short kebab-case label
//     prompt,        // complete standalone prompt for this unit
//     category,      // one of the CATEGORY_ROUTE keys below, or omit/null/
//                    // "inherit" to use the current session's model route
//   }],
//   mergePrompt,    // optional: prompt for a final merge step (default: none)
// }.
// meta = { name: "category-routed-work", description: "...", phases: [...] }.

// ROUTE TABLE - category -> { provider, model }.
// Same shape as opencode's category system: domain-optimized models.
// Keep in sync with settings.yaml llm-pi-ai.providers model ids.
// Cost policy (2026-08-15): pro reserved for genuinely hard reasoning
// (ultrabrain/deep). Generation-type tasks (artistry/writing) run on flash;
// unclassified/high-effort fallbacks inherit the user's session model.
const CATEGORY_ROUTE = {
  // Visual / UI / CSS / animation / design -> multimodal model (image input).
  "visual-engineering": { provider: "opencode-go", model: "mimo-v2.5" },
  // Hard logic, architecture, algorithms -> heavy-reasoning model.
  ultrabrain: { provider: "opencode-go", model: "deepseek-v4-pro" },
  // Deep research + autonomous implementation -> heavy-reasoning model.
  deep: { provider: "opencode-go", model: "deepseek-v4-pro" },
  // Adversarial / creative problem solving -> cheap model (high error tolerance).
  artistry: { provider: "opencode-go", model: "deepseek-v4-flash" },
  // Trivial single-file changes -> cheap model.
  quick: { provider: "opencode-go", model: "deepseek-v4-flash" },
  // General low-effort -> cheap model.
  "unspecified-low": { provider: "opencode-go", model: "deepseek-v4-flash" },
  // General high-effort, unclassified -> inherit the user's session model
  // (not pro): an unclassified task does not justify a pro upgrade by itself.
  "unspecified-high": null,
  // Prose / documentation / technical writing -> cheap model (generation, not reasoning).
  writing: { provider: "opencode-go", model: "deepseek-v4-flash" },
};

// Fallback when a unit omits or misspells its category: INHERIT the current
// session's model route. `agent()` without provider/model opts inherits the
// parent agent's route (= the model the user is currently using for this
// session), so an uncategorized unit follows the user's session model rather
// than being silently upgraded to pro or downgraded to flash.
// Explicitly pass category "inherit" (or omit category) for this behavior.
function routeFor(category) {
  return CATEGORY_ROUTE[category] ?? null; // null = inherit session route
}

const { task, units, mergePrompt } = args;
if (!Array.isArray(units) || units.length === 0) {
  throw new Error("category-router: args.units must be a non-empty array");
}

phase("dispatch");
const results = (
  await parallel(
    units.map((unit) => () => {
      const route = routeFor(unit.category);
      // RUNTIME model override - the whole point of this template. When the
      // unit has no category route, omit provider/model so the child inherits
      // the current session's model route.
      return agent(unit.prompt, {
        label: unit.id,
        phase: "dispatch",
        ...(route !== null
          ? { provider: route.provider, model: route.model }
          : {}),
      });
    })
  )
).filter(Boolean);

const byId = {};
for (let i = 0; i < units.length; i++) byId[units[i].id] = results[i];

const report = units.map((u) => {
  const r = routeFor(u.category);
  return {
    id: u.id,
    category: u.category ?? "inherit",
    routedTo: r !== null ? `${r.provider}/${r.model}` : "inherit:session",
    ok: results.length > 0,
  };
});

if (mergePrompt) {
  phase("merge");
  const merged = await agent(
    `${mergePrompt}\n\nRouted unit results (frozen, each unit ran on its category's model):\n${JSON.stringify(byId)}`,
    { label: "merge", phase: "merge" }
  );
  return { report, units: byId, merged };
}

return { report, units: byId };
