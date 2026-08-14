// hyperplan.js - adversarial review board: N hostile reviewers critique one
// plan/design from disjoint angles, then a lead synthesizes a final plan.
// Usage: workflow tool, script = this body (adapted), args = { plan, angles }.
// meta = { name: "hyperplan-review", description: "...", phases: [...] }.

const { plan, angles } = args; // angles: array of strings, one per reviewer

phase("critique");
const reviews = (await parallel(
  angles.map((angle) => () =>
    agent(
      `You are a hostile specialist reviewer (angle: ${angle}). The plan below will be executed. Critique it HARD: gaps, failure modes, wrong assumptions, edge cases, testability, risks. Do not soften. Return strict JSON. Plan:\n${plan}`,
      {
        schema: {
          type: "object",
          properties: {
            verdict: { type: "string", enum: ["approve", "revise", "reject"] },
            majorIssues: { type: "array", items: { type: "string" } },
            minorIssues: { type: "array", items: { type: "string" } },
            missingTests: { type: "array", items: { type: "string" } },
          },
          required: ["verdict", "majorIssues", "minorIssues", "missingTests"],
          additionalProperties: false,
        },
        label: `review-${angle}`,
        phase: "critique",
      }
    )
  )
)).filter(Boolean);

phase("synthesis");
const frozen = JSON.stringify(reviews); // reviewers stay blind to each other
const finalPlan = await agent(
  `You are the lead. ${reviews.length} independent hostile reviews of a plan were collected (frozen, each reviewer saw only the plan):\n${frozen}\nSynthesize: merge overlapping issues, resolve contradictions, keep what survives scrutiny, and produce the final decision-complete plan. Return strict JSON.`,
  {
    schema: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["approved", "revised", "rejected"] },
        finalPlanMarkdown: { type: "string" },
        addressedIssues: { type: "array", items: { type: "string" } },
        residualRisks: { type: "array", items: { type: "string" } },
      },
      required: ["verdict", "finalPlanMarkdown", "addressedIssues", "residualRisks"],
      additionalProperties: false,
    },
    label: "lead-synthesis",
    phase: "synthesis",
  }
);

return { reviews, finalPlan };
