# Write Specification

Generate a complete `specification.md` for the banking transaction pipeline following the
5-section template.

## Steps

1. Read `homework-3/specification-TEMPLATE-example.md` for the template structure
2. Read `homework-6/sample-transactions.json` to understand the input data shape
3. Fill in all 5 required sections:
   - **High-Level Objective** — one sentence describing the pipeline
   - **Mid-Level Objectives** — 4–5 concrete, testable requirements
   - **Implementation Notes** — Decimal for money, ISO 4217, logging, PII rules
   - **Context** — beginning state (sample-transactions.json) and ending state (shared/results/)
   - **Low-Level Tasks** — one entry per agent with Prompt, File, Function, Details
4. Write the result to `homework-6/specification.md`
5. Also update `homework-6/agents.md` with project-specific agent configuration

## Output Format

Each Low-Level Task entry must follow:
```
Task: [Agent Name]
Prompt: "[Exact prompt to give Claude/Copilot]"
File to CREATE: agents/[name].js
Function to CREATE: [functionName](params) → returnType
Details: [Specific requirements, thresholds, validation rules]
```

## Constraints

- Never use `float` for monetary values — always `decimal.js` Decimal
- Currency validation must reference ISO 4217 standard
- Logging must include ISO 8601 timestamp, agent name, transaction ID, outcome
- Account numbers must not appear in log output
