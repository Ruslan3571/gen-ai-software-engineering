const fs = require('fs');
const os = require('os');
const path = require('path');

const { checkCompliance, process } = require('../../agents/compliance_checker');

const makeTxn = (overrides = {}) => ({
  transaction_id: 'TXN001',
  timestamp: '2026-03-16T09:00:00Z',
  source_account: 'ACC-1001',
  destination_account: 'ACC-2001',
  amount: '1500.00',
  currency: 'USD',
  status: 'fraud_scored',
  risk_score: '0.00',
  risk_level: 'LOW',
  risk_factors: [],
  metadata: { channel: 'online', country: 'US' },
  ...overrides,
});

const makeSharedDirs = () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-'));
  for (const sub of ['input', 'processing', 'output', 'results']) {
    fs.mkdirSync(path.join(base, sub));
  }
  return base;
};

const writeFraudScoredMessage = (sharedDir, txnId, txnData) => {
  const message = {
    message_id: 'test-uuid',
    timestamp: new Date().toISOString(),
    source_agent: 'fraud_detector',
    target_agent: 'compliance_checker',
    message_type: 'fraud_scored',
    data: txnData,
  };
  fs.writeFileSync(
    path.join(sharedDir, 'output', `${txnId}.json`),
    JSON.stringify(message),
  );
};

describe('checkCompliance()', () => {
  it('returns compliant with no flags for clean transaction', () => {
    const { status, flags } = checkCompliance(makeTxn());
    expect(status).toBe('compliant');
    expect(flags).toHaveLength(0);
  });

  it('flags suspicious_destination for ACC-9999 (TXN003 scenario)', () => {
    const { flags } = checkCompliance(makeTxn({ destination_account: 'ACC-9999' }));
    expect(flags).toContain('suspicious_destination');
  });

  it('flags aml_reporting_required for amount >= $10,000 (TXN002 scenario)', () => {
    const { flags } = checkCompliance(makeTxn({
      amount: '25000.00',
      risk_level: 'HIGH',
    }));
    expect(flags).toContain('aml_reporting_required');
  });

  it('flags manual_review_required for CRITICAL risk (TXN005 scenario)', () => {
    const { flags } = checkCompliance(makeTxn({
      amount: '75000.00',
      risk_level: 'CRITICAL',
    }));
    expect(flags).toContain('manual_review_required');
    expect(flags).toContain('aml_reporting_required');
  });

  it('returns flagged status when any flag is present', () => {
    const { status } = checkCompliance(makeTxn({ destination_account: 'ACC-9999' }));
    expect(status).toBe('flagged');
  });

  it('accumulates multiple flags for severe transaction', () => {
    const { flags } = checkCompliance(makeTxn({
      amount: '75000.00',
      destination_account: 'ACC-9999',
      risk_level: 'CRITICAL',
    }));
    expect(flags).toContain('suspicious_destination');
    expect(flags).toContain('aml_reporting_required');
    expect(flags).toContain('manual_review_required');
    expect(flags).toHaveLength(3);
  });

  it('does not flag amounts exactly below AML threshold', () => {
    const { flags } = checkCompliance(makeTxn({ amount: '9999.99' }));
    expect(flags).not.toContain('aml_reporting_required');
  });
});

describe('process()', () => {
  it('writes compliant result to results/', () => {
    const sharedDir = makeSharedDirs();
    writeFraudScoredMessage(sharedDir, 'TXN001', makeTxn());

    const stats = process(sharedDir);

    expect(stats.compliant).toBe(1);
    expect(stats.flagged).toBe(0);
    const result = JSON.parse(fs.readFileSync(path.join(sharedDir, 'results', 'TXN001.json'), 'utf8'));
    expect(result.data.status).toBe('compliant');
    expect(result.data.compliance_flags).toHaveLength(0);
    expect(result.message_type).toBe('compliance_reviewed');
  });

  it('writes flagged result to results/ and removes from output/', () => {
    const sharedDir = makeSharedDirs();
    writeFraudScoredMessage(sharedDir, 'TXN002', makeTxn({
      transaction_id: 'TXN002',
      amount: '25000.00',
      risk_level: 'HIGH',
    }));

    const stats = process(sharedDir);

    expect(stats.flagged).toBe(1);
    expect(stats.compliant).toBe(0);
    expect(fs.existsSync(path.join(sharedDir, 'output', 'TXN002.json'))).toBe(false);
    const result = JSON.parse(fs.readFileSync(path.join(sharedDir, 'results', 'TXN002.json'), 'utf8'));
    expect(result.data.status).toBe('flagged');
    expect(result.data.compliance_flags).toContain('aml_reporting_required');
  });

  it('skips messages that are not fraud_scored type', () => {
    const sharedDir = makeSharedDirs();
    const wrongType = {
      message_id: 'uuid',
      timestamp: new Date().toISOString(),
      source_agent: 'other',
      target_agent: 'compliance_checker',
      message_type: 'validated',
      data: makeTxn(),
    };
    fs.writeFileSync(path.join(sharedDir, 'output', 'wrong.json'), JSON.stringify(wrongType));

    const stats = process(sharedDir);
    expect(stats.compliant).toBe(0);
    expect(stats.flagged).toBe(0);
  });
});
