# Run Pipeline

Run the multi-agent banking pipeline end-to-end.

## Steps

1. Check that `homework-6/sample-transactions.json` exists; if not, stop and report
2. Change directory to `homework-6/`
3. Clear `shared/` directories by running `node integrator.js` (integrator handles cleanup)
4. Run the pipeline: `node integrator.js`
5. Show the summary of results from `shared/results/`:
   - Total transactions processed
   - Count of compliant, flagged, and rejected
6. Report any rejected transactions with their rejection reason
7. Report any flagged transactions with their compliance flags

## Expected output

```
[integrator] Starting banking transaction pipeline...
[Phase 1] Transaction Validator
[Phase 2] Fraud Detector
[Phase 3] Compliance Checker

════ PIPELINE SUMMARY ════
Total processed : 8
Compliant       : 3
Flagged         : 3
Rejected        : 2
```

## Notes

- The pipeline is idempotent: each run clears `shared/` and starts fresh
- Results are written as JSON files to `shared/results/`
- Run `npm run validate` for dry-run validation without processing
