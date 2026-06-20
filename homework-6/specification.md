# Banking Transaction Pipeline — Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate
> the code that will satisfy the High and Mid-Level Objectives.

---

## High-Level Objective

Build a multi-agent transaction processing pipeline that validates, scores for fraud, and
checks compliance for banking transactions, routing each through a chain of cooperating
agents and writing structured results to a shared filesystem.

---

## Mid-Level Objectives

- Transactions with invalid fields, negative/zero amounts, or non-ISO-4217 currency codes
  are rejected by the validator with a human-readable reason field
- Transactions above $10,000 are flagged for fraud review with a numeric risk score (0.00–1.00)
  and a risk level of HIGH or CRITICAL
- Transactions between $9,000 and $10,000 are flagged as potential structuring attempts
  (MEDIUM risk)
- Rejected transactions are written to `shared/results/` with a `rejection_reason` field;
  compliant transactions include `compliance_flags: []`
- All agent operations are logged to stdout with ISO 8601 timestamps, agent name, transaction
  ID, and outcome — no account numbers or sensitive data in log lines

---

## Implementation Notes

- **Monetary values**: always use `decimal.js` `Decimal` type — never native `float` or
  JavaScript number arithmetic for amounts
- **Currency codes**: validate against ISO 4217 (full set of ~170 codes)
- **Timestamps**: ISO 8601 with Z suffix; parse/validate with `new Date().toISOString()`
- **Logging**: structured one-liner per operation — `[ISO8601] [agent_name] TXN_ID → outcome`
- **PII**: account numbers must not appear in log output; only transaction IDs are logged
- **Message envelope**: every file passed between agents follows the standard JSON schema
  with `message_id` (crypto.randomUUID), `timestamp`, `source_agent`, `target_agent`,
  `message_type`, and `data`
- **Agent isolation**: each agent is a pure Node.js CommonJS module exporting a `process()`
  function that reads from and writes to `shared/` subdirectories

---

## Context

### Beginning state

- `sample-transactions.json` — 8 raw transaction records with intentional edge cases:
  - TXN006: invalid currency "XYZ"
  - TXN007: negative amount "-100.00"
  - TXN002, TXN005: high-value wire transfers (>$10k)
  - TXN003: structuring threshold ($9,999.99)
  - TXN004: cross-border + unusual hour (02:47 UTC, country DE)

### Ending state

- `shared/results/` contains one JSON file per transaction (8 total)
- Each result file contains the full message envelope with enriched `data` field
- Pipeline summary printed to stdout after each run
- Test coverage ≥ 90% verified by `npm test`

---

## Low-Level Tasks

### Task: Transaction Validator (Agent 1)

```
Prompt: "Create a transaction validator module that reads JSON message files from
shared/input/, validates each transaction for required fields, positive Decimal amount,
and ISO 4217 currency code, then routes valid transactions to shared/output/ and rejected
ones to shared/results/ with a rejection_reason field."

File to CREATE: agents/transaction_validator.js
Function to CREATE: validate(transaction) → { valid, reason }
                    process(sharedDir) → { validated, rejected }

Details:
- REQUIRED_TRANSACTION_FIELDS: transaction_id, timestamp, source_account,
  destination_account, amount, currency, transaction_type
- Amount: new Decimal(String(amount)) — must be > 0
- Currency: must be in ISO_4217_CURRENCIES Set from src/constants/index.js
- Timestamp: must parse as valid Date
- Dry-run mode: --dry-run CLI flag reads sample-transactions.json and prints
  a validation table without writing to shared/
```

### Task: Fraud Detector (Agent 2)

```
Prompt: "Create a fraud detector that reads validated transactions from shared/output/,
calculates a risk score using Decimal arithmetic, assigns a risk level, and routes
LOW-risk transactions to shared/results/ as compliant and MEDIUM/HIGH/CRITICAL to
shared/output/ for compliance checking."

File to CREATE: agents/fraud_detector.js
Function to CREATE: calculateRiskScore(transaction) → { score, riskLevel, factors }
                    process(sharedDir) → { low, elevated }

Details:
- Risk weights (Decimal): high_value +0.60, structuring +0.30, unusual_hour +0.20,
  cross_border +0.15
- HIGH_VALUE threshold: $10,000; STRUCTURING_LOW: $9,000
- Unusual hour: UTC hour in [0, 6)
- Cross-border: metadata.country !== 'US'
- Risk levels: CRITICAL ≥ 0.70, HIGH ≥ 0.50, MEDIUM ≥ 0.30, LOW < 0.30
```

### Task: Compliance Checker (Agent 3)

```
Prompt: "Create a compliance checker that reads fraud-scored transactions from
shared/output/, applies AML and account-watchlist checks, and writes all results to
shared/results/ with a compliance_flags array and final status (compliant or flagged)."

File to CREATE: agents/compliance_checker.js
Function to CREATE: checkCompliance(transaction) → { status, flags }
                    process(sharedDir) → { compliant, flagged }

Details:
- SUSPICIOUS_ACCOUNTS: Set(['ACC-9999'])
- AML_THRESHOLD: Decimal('10000') — flag aml_reporting_required
- CRITICAL risk_level → flag manual_review_required
- Suspicious destination → flag suspicious_destination
- status: 'compliant' if flags.length === 0, else 'flagged'
```

### Task: Integrator / Orchestrator

```
Prompt: "Create an integrator that orchestrates the three pipeline agents sequentially:
setup shared/ dirs, load sample-transactions.json, write messages to shared/input/,
run validator → fraud_detector → compliance_checker, then print a summary table."

File to CREATE: integrator.js
Function to CREATE: runPipeline() → summary object
                    setupSharedDirs(sharedDir) → void
                    clearSharedDirs(sharedDir) → void

Details:
- Single command: node integrator.js
- Shared subdirs: input/, processing/, output/, results/
- Summary: total, validated, rejected, compliant, flagged counts
- Each transaction becomes one message file named TXN001.json etc.
```
