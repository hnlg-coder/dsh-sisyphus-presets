// security-research.js - 3 hunters find vulnerabilities in parallel, 2 PoC
// engineers prove exploitability, lead classifies root causes and calibrates
// severity. Usage: workflow tool, script = this body (adapted), args = target.
// meta = { name: "security-audit", description: "...", phases: [...] }.

const { target } = args; // e.g. { repo, scope, files }

phase("hunt");
const huntingAngles = ["input validation & injection", "auth/authz & privilege", "data exposure & secrets"];
const hunts = (
  await parallel(
    huntingAngles.map((angle) => () =>
      agent(
        `You are vulnerability hunter ${angle}. Audit this target for exploitable vulnerabilities in your area. You are read-only; report, do not fix. Return strict JSON with concrete evidence (file:line where possible). Target:\n${JSON.stringify(target)}`,
        {
          schema: {
            type: "object",
            properties: {
              findings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    evidence: { type: "string" },
                    kind: { type: "string", enum: ["finding", "clean"] },
                    rootCause: { type: "string" },
                  },
                  required: ["id", "title", "evidence", "kind", "rootCause"],
                  additionalProperties: false,
                },
              },
            },
            required: ["findings"],
            additionalProperties: false,
          },
          label: `hunter-${angle}`,
          phase: "hunt",
        }
      )
    )
  )
).filter(Boolean);

const allFindings = hunts.flatMap((h) => h.findings).filter((f) => f.kind === "finding");

phase("poc");
const half = Math.ceil(allFindings.length / 2);
const pocJobs = [
  { slice: allFindings.slice(0, half), name: "poc-a" },
  { slice: allFindings.slice(half), name: "poc-b" },
].filter((j) => j.slice.length > 0);
const pocs = (
  await parallel(
    pocJobs.map((job) => () =>
      agent(
        `You are a PoC engineer. Attempt to PROVE exploitability of each finding below with a minimal reproduction (code or exact request sequence). Do not exploit beyond demonstration; do not modify the target persistently. Mark proven/unproven. Return strict JSON. Findings:\n${JSON.stringify(job.slice)}`,
        {
          schema: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    proven: { type: "boolean" },
                    reproduction: { type: "string" },
                    notes: { type: "string" },
                  },
                  required: ["id", "proven", "reproduction", "notes"],
                  additionalProperties: false,
                },
              },
            },
            required: ["results"],
            additionalProperties: false,
          },
          label: job.name,
          phase: "poc",
        }
      )
    )
  )
).filter(Boolean);

phase("classify");
const report = await agent(
  `Classify and calibrate this security audit. For each finding: severity (critical/high/medium/low) calibrated by ACTUAL exploitability (PoC proven/unproven), root-cause category, and remediation. Return strict JSON. Findings+PoCs:\n${JSON.stringify({ allFindings, pocs })}`,
  {
    schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        classified: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
              rootCauseCategory: { type: "string" },
              remediation: { type: "string" },
            },
            required: ["id", "severity", "rootCauseCategory", "remediation"],
            additionalProperties: false,
          },
        },
        blockingFlags: { type: "array", items: { type: "string" } },
      },
      required: ["summary", "classified", "blockingFlags"],
      additionalProperties: false,
    },
    label: "lead-classify",
    phase: "classify",
  }
);

return { findingsCount: allFindings.length, report };
