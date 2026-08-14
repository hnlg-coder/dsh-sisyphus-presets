// parallel-exploration.js - fan out 2-5 independent investigation angles in
// parallel, then merge findings into one structured report.
// Usage: workflow tool, script = this body (adapted), args = { question, angles }.
// meta = { name: "parallel-explore", description: "...", phases: [...] }.

const { question, angles } = args; // angles: array of strings, one per lane

phase("explore");
const lanes = (
  await parallel(
    angles.map((angle) => () =>
      agent(
        `Investigate this question from the angle "${angle}". Gather concrete evidence (paths, sources, excerpts), not vibes. Return strict JSON. Question:\n${question}`,
        {
          schema: {
            type: "object",
            properties: {
              findings: { type: "array", items: { type: "string" } },
              evidence: { type: "array", items: { type: "string" } },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              openQuestions: { type: "array", items: { type: "string" } },
            },
            required: ["findings", "evidence", "confidence", "openQuestions"],
            additionalProperties: false,
          },
          label: `lane-${angle}`,
          phase: "explore",
        }
      )
    )
  )
).filter(Boolean);

phase("merge");
const merged = await agent(
  `Merge these independent investigation lanes into one coherent answer. Deduplicate, resolve contradictions, and flag remaining gaps. Return strict JSON. Lanes:\n${JSON.stringify(lanes)}`,
  {
    schema: {
      type: "object",
      properties: {
        answer: { type: "string" },
        keyEvidence: { type: "array", items: { type: "string" } },
        contradictions: { type: "array", items: { type: "string" } },
        gaps: { type: "array", items: { type: "string" } },
      },
      required: ["answer", "keyEvidence", "contradictions", "gaps"],
      additionalProperties: false,
    },
    label: "merge",
    phase: "merge",
  }
);

return { lanes, merged };
