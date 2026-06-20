# Agent Configuration — Banking Transaction Pipeline

Extended from the virtual card lifecycle agent config (Homework 3).
Adapted for the multi-agent transaction processing pipeline.

---

## Tech Stack

- **Runtime**: Node.js 18+
- **Money**: `decimal.js` — `new Decimal(String(amount))` — never native `number` for amounts
- **Testing**: Jest 29, coverage threshold 80% (target 90%)
- **Linting**: ESLint 9 with project `eslint.config.js`
- **MCP server**: Python 3.11+ with FastMCP (mcp/server.py only)
- **Message passing**: JSON files in `shared/` subdirectories

---

## Pipeline Architecture

```
sample-transactions.json
        │
   [integrator.js]  ← orchestrates all agents
        │
        ▼ shared/input/
[transaction_validator.js]
        ├──(invalid)──► shared/results/  (status: rejected)
        └──(valid)────► shared/output/
                              │
                    [fraud_detector.js]
                              ├──(LOW)────► shared/results/  (status: compliant)
                              └──(elevated)► shared/output/
                                                  │
                                      [compliance_checker.js]
                                                  │
                                                  ▼
                                          shared/results/
                                    (status: compliant | flagged)
```

---

## Domain Rules

### Decimal for Money
- All amount comparisons: `new Decimal(String(txn.amount)).gte(threshold)`
- Risk score accumulation: `score = score.plus(weight)`
- Never: `parseFloat(txn.amount) > 10000`

### ISO 4217 Currency Validation
- Validate against the full `ISO_4217_CURRENCIES` Set in `src/constants/index.js`
- TXN006 (`XYZ`) must be rejected

### PII Protection
- Never log `source_account` or `destination_account` in plain text
- Log only `transaction_id` and outcome

### Message Envelope (standard format)
```json
{
  "message_id": "crypto.randomUUID()",
  "timestamp": "ISO 8601 with Z",
  "source_agent": "agent_name",
  "target_agent": "next_agent_name",
  "message_type": "new_transaction | validated | rejected | fraud_scored | compliance_reviewed",
  "data": {
    "transaction_id": "TXN001",
    "amount": "1500.00",
    "currency": "USD",
    "status": "pending | validated | rejected | fraud_scored | compliant | flagged"
  }
}
```

### Logging Format
```
[2026-03-16T10:00:00.000Z] [transaction_validator] TXN001 → validated
[2026-03-16T10:00:00.001Z] [fraud_detector] TXN001 → low risk (0.00) → compliant
[2026-03-16T10:00:00.002Z] [compliance_checker] TXN001 → compliant [none]
```

---

## Agent Behavioral Rules

When generating code, agents must:

1. **Use constants, not hardcoded values** — all thresholds, currencies, field names from `src/constants/index.js`
2. **Use Decimal for all monetary arithmetic** — never native JS number for amounts
3. **Write tests alongside code** — minimum 3 unit tests per exported function
4. **Pure business logic in exported functions** — `validate()`, `calculateRiskScore()`, `checkCompliance()` must be pure and testable without filesystem
5. **process() for file I/O** — keep filesystem operations in `process(sharedDir)` only
6. **No secrets committed** — mcp.json uses runtime paths, no tokens
7. **CommonJS exports** — `module.exports = { validate, process }` pattern
8. **Import order** — builtin → external (decimal.js) → internal (constants, utils)

---

## Four Meta-Agents (Homework 6 concept)

| Meta-Agent | Role | Deliverable |
|------------|------|-------------|
| **Agent 1 — Specification** | Writes `specification.md` from template | `specification.md`, this `agents.md`, `.cursor/commands/write-spec.md` |
| **Agent 2 — Code Generation** | Implements pipeline using context7 MCP | `agents/*.js`, `integrator.js`, `research-notes.md` |
| **Agent 3 — Unit Tests** | Creates test suite with ≥80% coverage gate | `tests/`, `.cursor/hooks.json`, `jest.config.js` |
| **Agent 4 — Documentation** | Generates README and HOWTORUN | `README.md` (with author name), `HOWTORUN.md` |

---

## Expected Outcomes Per Transaction

| TXN | Amount | Currency | Expected Status | Agent that decides |
|-----|--------|----------|-----------------|--------------------|
| TXN001 | $1,500 | USD | compliant | compliance_checker |
| TXN002 | $25,000 | USD | flagged (aml + manual_review) | compliance_checker |
| TXN003 | $9,999.99 | USD | flagged (aml) | compliance_checker |
| TXN004 | $500 | EUR | compliant | compliance_checker |
| TXN005 | $75,000 | USD | flagged (aml + manual_review) | compliance_checker |
| TXN006 | $200 | XYZ | rejected (invalid currency) | transaction_validator |
| TXN007 | -$100 | GBP | rejected (negative amount) | transaction_validator |
| TXN008 | $3,200 | USD | compliant | fraud_detector (LOW) |
