const fs = require('fs');
const os = require('os');
const path = require('path');

const { runPipeline, setupSharedDirs, clearSharedDirs, loadTransactions } = require('../../integrator');

const SAMPLE_TRANSACTIONS_PATH = path.join(__dirname, '../../sample-transactions.json');

const makeSharedDir = () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-integration-'));
  return base;
};

describe('Full pipeline integration', () => {
  let sharedDir;

  beforeEach(() => {
    sharedDir = makeSharedDir();
  });

  afterEach(() => {
    fs.rmSync(sharedDir, { recursive: true, force: true });
  });

  it('processes all 8 sample transactions and writes 8 result files', () => {
    const summary = runPipeline(sharedDir, SAMPLE_TRANSACTIONS_PATH);

    const resultsDir = path.join(sharedDir, 'results');
    const resultFiles = fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json'));

    expect(resultFiles).toHaveLength(8);
    expect(summary.total).toBe(8);
  });

  it('rejects TXN006 (invalid currency XYZ) and TXN007 (negative amount)', () => {
    runPipeline(sharedDir, SAMPLE_TRANSACTIONS_PATH);

    const resultsDir = path.join(sharedDir, 'results');

    const txn006 = JSON.parse(fs.readFileSync(path.join(resultsDir, 'TXN006.json'), 'utf8'));
    expect(txn006.data.status).toBe('rejected');
    expect(txn006.data.rejection_reason).toMatch(/Invalid ISO 4217 currency code: XYZ/);

    const txn007 = JSON.parse(fs.readFileSync(path.join(resultsDir, 'TXN007.json'), 'utf8'));
    expect(txn007.data.status).toBe('rejected');
    expect(txn007.data.rejection_reason).toMatch(/Amount must be positive/);
  });

  it('flags TXN002 ($25,000) and TXN005 ($75,000) as AML required', () => {
    runPipeline(sharedDir, SAMPLE_TRANSACTIONS_PATH);

    const resultsDir = path.join(sharedDir, 'results');

    const txn002 = JSON.parse(fs.readFileSync(path.join(resultsDir, 'TXN002.json'), 'utf8'));
    expect(txn002.data.status).toBe('flagged');
    expect(txn002.data.compliance_flags).toContain('aml_reporting_required');

    // TXN005: $75k, US daytime → HIGH risk (score 0.60), not CRITICAL (needs ≥0.70)
    // Gets aml_reporting_required only (amount ≥ $10k); no manual_review_required
    const txn005 = JSON.parse(fs.readFileSync(path.join(resultsDir, 'TXN005.json'), 'utf8'));
    expect(txn005.data.status).toBe('flagged');
    expect(txn005.data.compliance_flags).toContain('aml_reporting_required');
    expect(txn005.data.risk_level).toBe('HIGH');
  });

  it('summary counts match expected distribution', () => {
    const summary = runPipeline(sharedDir, SAMPLE_TRANSACTIONS_PATH);
    expect(summary.rejected).toBe(2);
    expect(summary.compliant + summary.flagged).toBe(6);
    expect(summary.total).toBe(8);
  });

  it('clears shared/ dirs on repeated runs (idempotent)', () => {
    runPipeline(sharedDir, SAMPLE_TRANSACTIONS_PATH);
    const summary2 = runPipeline(sharedDir, SAMPLE_TRANSACTIONS_PATH);

    const resultFiles = fs.readdirSync(path.join(sharedDir, 'results')).filter((f) => f.endsWith('.json'));
    expect(resultFiles).toHaveLength(8);
    expect(summary2.total).toBe(8);
  });
});

describe('loadTransactions()', () => {
  it('loads and parses sample-transactions.json correctly', () => {
    const transactions = loadTransactions(SAMPLE_TRANSACTIONS_PATH);
    expect(Array.isArray(transactions)).toBe(true);
    expect(transactions).toHaveLength(8);
    expect(transactions[0]).toHaveProperty('transaction_id');
    expect(transactions[0]).toHaveProperty('amount');
  });
});

describe('setupSharedDirs() and clearSharedDirs()', () => {
  it('creates all required subdirectories', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-test-'));
    setupSharedDirs(base);

    for (const sub of ['input', 'processing', 'output', 'results']) {
      expect(fs.existsSync(path.join(base, sub))).toBe(true);
    }
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('clearSharedDirs removes files but keeps directories', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'clear-test-'));
    setupSharedDirs(base);
    fs.writeFileSync(path.join(base, 'input', 'test.json'), '{}');

    clearSharedDirs(base);

    expect(fs.existsSync(path.join(base, 'input'))).toBe(true);
    expect(fs.readdirSync(path.join(base, 'input'))).toHaveLength(0);
    fs.rmSync(base, { recursive: true, force: true });
  });
});
