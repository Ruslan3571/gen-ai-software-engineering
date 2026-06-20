# How to Run

Step-by-step guide to install, run, and test the banking pipeline.

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 18+ |
| npm | 9+ |
| Python | 3.11+ |
| pip | Latest |

---

## Step 1: Install Node.js dependencies

```bash
cd homework-6
npm install
```

Installs: `decimal.js`, `jest`, `eslint`.

---

## Step 2: Run the pipeline

```bash
node integrator.js
```

Or via npm script:

```bash
npm run pipeline
```

The pipeline:
1. Clears `shared/` directories
2. Loads `sample-transactions.json` (8 transactions)
3. Runs Transaction Validator → Fraud Detector → Compliance Checker
4. Writes results to `shared/results/` (8 JSON files)
5. Prints a summary table to stdout

---

## Step 3: Validate transactions only (dry-run)

```bash
npm run validate
# or
node agents/transaction_validator.js --dry-run
```

Reads `sample-transactions.json` and prints a validation table without writing to `shared/`.

---

## Step 4: Run tests with coverage

```bash
npm test
```

Runs 44 tests across 4 test suites (unit + integration).  
Coverage gate: fails if any metric drops below **80%**.

---

## Step 5: Install and run the custom MCP server

```bash
cd mcp
python3 -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python server.py
```

Starts in stdio mode. Connect via Cursor Settings → MCP → enable `pipeline-status`.

---

## Step 6: Connect MCP configuration to Cursor

```bash
# From repository root
cp homework-6/mcp.json .cursor/mcp.json
```

Restart Cursor or toggle servers in **Settings → MCP**.

Enable both:
- **context7** — for library documentation lookup
- **pipeline-status** — for querying pipeline results

---

## Step 7: Test MCP tools (after running the pipeline)

In Cursor chat:

```
What is the status of transaction TXN002?
```

```
List all pipeline results
```

```
Read the pipeline://summary resource
```

---

## Step 8: Use Cursor skills

Copy commands to workspace root to use as slash commands:

```bash
cp -r homework-6/.cursor/commands/* .cursor/commands/
```

Then in Cursor chat:

- `/run-pipeline` — runs the full pipeline end-to-end
- `/validate-transactions` — validates without processing
- `/write-spec` — regenerates specification.md from template

---

## Step 9: Coverage gate hook

The hook in `homework-6/.cursor/hooks.json` intercepts `git push` and runs `npm test`.

To activate for the workspace, copy to the project root:

```bash
cp homework-6/.cursor/hooks.json .cursor/hooks.json
cp -r homework-6/.cursor/hooks .cursor/hooks
chmod +x .cursor/hooks/coverage-gate.sh
```

Verify in **Cursor Settings → Hooks**.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Cannot find module 'decimal.js'` | Run `npm install` in `homework-6/` |
| `shared/results/` is empty | Run `node integrator.js` first |
| `pipeline-status` MCP not connecting | Run `pip install fastmcp` in `mcp/.venv` |
| Coverage below 80% | Check `npm test` output; uncovered lines are the `runDryRun` CLI block |
| Hook not firing | Verify `hooks.json` is at project root `.cursor/hooks.json` |

---

## Deliverables Checklist

- [x] `specification.md` — 5 sections, Low-Level Tasks per agent
- [x] `agents.md` — extended agent config with pipeline context
- [x] `.cursor/commands/write-spec.md` — spec generation skill
- [x] `agents/transaction_validator.js` — validator with `--dry-run`
- [x] `agents/fraud_detector.js` — risk scoring with Decimal
- [x] `agents/compliance_checker.js` — AML + watchlist checks
- [x] `integrator.js` — single-command pipeline orchestrator
- [x] `research-notes.md` — 3 context7 queries documented
- [x] `.cursor/commands/run-pipeline.md` — pipeline skill
- [x] `.cursor/commands/validate-transactions.md` — validation skill
- [x] `.cursor/hooks.json` + `.cursor/hooks/coverage-gate.sh` — coverage gate
- [x] `mcp/server.py` — FastMCP with 2 tools + 1 resource
- [x] `mcp.json` — context7 + pipeline-status
- [x] `tests/` — 44 tests, 92%+ coverage
- [x] `README.md` — author name, ASCII diagram, tech stack
- [x] `docs/screenshots/` — 5 required screenshots (capture during demo)
