const fs = require('fs');
const os = require('os');
const path = require('path');

const { calculateRiskScore, process } = require('../../agents/fraud_detector');

const makeTxn = (overrides = {}) => ({
  transaction_id: 'TXN001',
  timestamp: '2026-03-16T09:00:00Z',
  source_account: 'ACC-1001',
  destination_account: 'ACC-2001',
  amount: '1500.00',
  currency: 'USD',
  transaction_type: 'transfer',
  status: 'validated',
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

const writeOutputMessage = (sharedDir, txnId, txnData) => {
  const message = {
    message_id: 'test-uuid',
    timestamp: new Date().toISOString(),
    source_agent: 'transaction_validator',
    target_agent: 'fraud_detector',
    message_type: 'validated',
    data: txnData,
  };
  fs.writeFileSync(
    path.join(sharedDir, 'output', `${txnId}.json`),
    JSON.stringify(message),
  );
};

describe('calculateRiskScore()', () => {
  it('returns LOW risk for small US daytime transaction', () => {
    const { score, riskLevel, factors } = calculateRiskScore(makeTxn({ amount: '500.00' }));
    expect(riskLevel).toBe('LOW');
    expect(parseFloat(score)).toBe(0);
    expect(factors).toHaveLength(0);
  });

  it('returns HIGH risk for transaction above $10,000 (TXN002 scenario)', () => {
    const { riskLevel, factors } = calculateRiskScore(makeTxn({ amount: '25000.00' }));
    expect(riskLevel).toBe('HIGH');
    expect(factors).toContain('high_value_transaction');
  });

  it('returns CRITICAL risk for high-value transaction with unusual hour', () => {
    // high_value (0.60) + unusual_hour (0.20) = 0.80 → CRITICAL
    const { score, riskLevel } = calculateRiskScore(makeTxn({
      amount: '75000.00',
      timestamp: '2026-03-16T03:00:00Z',
    }));
    expect(riskLevel).toBe('CRITICAL');
    expect(parseFloat(score)).toBeGreaterThanOrEqual(0.70);
  });

  it('returns MEDIUM risk for structuring threshold (TXN003 scenario)', () => {
    const { riskLevel, factors } = calculateRiskScore(makeTxn({ amount: '9999.99' }));
    expect(riskLevel).toBe('MEDIUM');
    expect(factors).toContain('structuring_threshold');
  });

  it('adds unusual_hour factor for early morning transactions (TXN004 scenario)', () => {
    const { factors } = calculateRiskScore(makeTxn({
      timestamp: '2026-03-16T02:47:00Z',
      amount: '500.00',
    }));
    expect(factors).toContain('unusual_hour');
  });

  it('adds cross_border factor for non-US country (TXN004 scenario)', () => {
    const { factors } = calculateRiskScore(makeTxn({
      metadata: { country: 'DE' },
    }));
    expect(factors).toContain('cross_border');
  });

  it('accumulates multiple risk factors (TXN004: EUR + DE + unusual hour)', () => {
    const { score, factors } = calculateRiskScore(makeTxn({
      timestamp: '2026-03-16T02:47:00Z',
      amount: '500.00',
      metadata: { country: 'DE' },
    }));
    expect(factors).toContain('unusual_hour');
    expect(factors).toContain('cross_border');
    expect(parseFloat(score)).toBeCloseTo(0.35, 2);
  });

  it('defaults to US country when metadata is missing', () => {
    const { factors } = calculateRiskScore(makeTxn({ metadata: undefined }));
    expect(factors).not.toContain('cross_border');
  });

  it('returns score as fixed 2-decimal string', () => {
    const { score } = calculateRiskScore(makeTxn({ amount: '25000.00' }));
    expect(score).toMatch(/^\d+\.\d{2}$/);
  });
});

describe('process()', () => {
  it('routes LOW risk transaction to results/ as compliant', () => {
    const sharedDir = makeSharedDirs();
    writeOutputMessage(sharedDir, 'TXN001', makeTxn({ amount: '500.00' }));

    const stats = process(sharedDir);

    expect(stats.low).toBe(1);
    expect(stats.elevated).toBe(0);
    const result = JSON.parse(fs.readFileSync(path.join(sharedDir, 'results', 'TXN001.json'), 'utf8'));
    expect(result.data.status).toBe('compliant');
  });

  it('keeps HIGH risk transaction in output/ for compliance checking', () => {
    const sharedDir = makeSharedDirs();
    writeOutputMessage(sharedDir, 'TXN002', makeTxn({ transaction_id: 'TXN002', amount: '25000.00' }));

    const stats = process(sharedDir);

    expect(stats.elevated).toBe(1);
    expect(stats.low).toBe(0);
    expect(fs.existsSync(path.join(sharedDir, 'output', 'TXN002.json'))).toBe(true);
    const message = JSON.parse(fs.readFileSync(path.join(sharedDir, 'output', 'TXN002.json'), 'utf8'));
    expect(message.message_type).toBe('fraud_scored');
    expect(message.data.risk_level).toBe('HIGH');
  });

  it('skips messages that are not validated type', () => {
    const sharedDir = makeSharedDirs();
    const staleMessage = {
      message_id: 'uuid',
      timestamp: new Date().toISOString(),
      source_agent: 'other',
      target_agent: 'fraud_detector',
      message_type: 'fraud_scored',
      data: makeTxn(),
    };
    fs.writeFileSync(path.join(sharedDir, 'output', 'stale.json'), JSON.stringify(staleMessage));

    const stats = process(sharedDir);
    expect(stats.low).toBe(0);
    expect(stats.elevated).toBe(0);
  });
});
