# Validate Transactions

Validate all transactions in `sample-transactions.json` without running the full pipeline.

## Steps

1. Change directory to `homework-6/`
2. Run the validator in dry-run mode: `node agents/transaction_validator.js --dry-run`
3. Report the results:
   - Total count of transactions
   - Valid count
   - Invalid count
   - Reasons for each rejection
4. Show a table of results with columns: ID, Status, Reason

## Expected output

```
Dry-run validation — sample-transactions.json

ID       Status    Reason
────────────────────────────────────────────────────────────
TXN001   VALID     —
TXN002   VALID     —
TXN003   VALID     —
TXN004   VALID     —
TXN005   VALID     —
TXN006   INVALID   Invalid ISO 4217 currency code: XYZ
TXN007   INVALID   Amount must be positive, got: -100.00
TXN008   VALID     —
────────────────────────────────────────────────────────────
Total: 8  Valid: 6  Invalid: 2
```

## Notes

- Dry-run mode does NOT write to `shared/` directories
- Reads directly from `sample-transactions.json`
- Use this to preview validation results before committing to a full pipeline run
