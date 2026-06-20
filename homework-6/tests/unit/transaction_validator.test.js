const fs = require('fs');
const os = require('os');
const path = require('path');

const { validate, process } = require('../../agents/transaction_validator');

const makeTxn = (overrides = {}) => ({
  transaction_id: 'TXN001',
  timestamp: '2026-03-16T09:00:00Z',
  source_account: 'ACC-1001',
  destination_account: 'ACC-2001',
  amount: '1500.00',
  currency: 'USD',
  transaction_type: 'transfer',
  description: 'Test payment',
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

const writeInputMessage = (sharedDir, txnId, txnData) => {
  const message = {
    message_id: 'test-uuid',
    timestamp: new Date().toISOString(),
    source_agent: 'integrator',
    target_agent: 'transaction_validator',
    message_type: 'new_transaction',
    data: { ...txnData, status: 'pending' },
  };
  fs.writeFileSync(
    path.join(sharedDir, 'input', `${txnId}.json`),
    JSON.stringify(message),
  );
};

describe('validate()', () => {
  it('accepts a valid transaction', () => {
    const result = validate(makeTxn());
    expect(result.valid).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('rejects when transaction_id is missing', () => {
    const result = validate(makeTxn({ transaction_id: '' }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Missing required field: transaction_id/);
  });

  it('rejects when amount is missing', () => {
    const result = validate(makeTxn({ amount: null }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Missing required field: amount/);
  });

  it('rejects negative amounts (TXN007 scenario)', () => {
    const result = validate(makeTxn({ amount: '-100.00' }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Amount must be positive/);
  });

  it('rejects zero amount', () => {
    const result = validate(makeTxn({ amount: '0' }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Amount must be positive/);
  });

  it('rejects invalid currency code (TXN006 scenario)', () => {
    const result = validate(makeTxn({ currency: 'XYZ' }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Invalid ISO 4217 currency code: XYZ/);
  });

  it('accepts valid ISO 4217 currencies', () => {
    for (const currency of ['USD', 'EUR', 'GBP', 'JPY']) {
      const result = validate(makeTxn({ currency }));
      expect(result.valid).toBe(true);
    }
  });

  it('rejects invalid timestamp', () => {
    const result = validate(makeTxn({ timestamp: 'not-a-date' }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Invalid ISO 8601 timestamp/);
  });

  it('rejects malformed amount string', () => {
    const result = validate(makeTxn({ amount: 'abc' }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Invalid amount format/);
  });

  it('accepts large valid amounts (TXN005 scenario)', () => {
    const result = validate(makeTxn({ amount: '75000.00', transaction_type: 'wire_transfer' }));
    expect(result.valid).toBe(true);
  });
});

describe('process()', () => {
  it('routes valid transaction to output/', () => {
    const sharedDir = makeSharedDirs();
    writeInputMessage(sharedDir, 'TXN001', makeTxn());

    const stats = process(sharedDir);

    expect(stats.validated).toBe(1);
    expect(stats.rejected).toBe(0);
    expect(fs.existsSync(path.join(sharedDir, 'output', 'TXN001.json'))).toBe(true);
    expect(fs.readdirSync(path.join(sharedDir, 'input'))).toHaveLength(0);
  });

  it('routes invalid transaction to results/', () => {
    const sharedDir = makeSharedDirs();
    writeInputMessage(sharedDir, 'TXN006', makeTxn({ transaction_id: 'TXN006', currency: 'XYZ' }));

    const stats = process(sharedDir);

    expect(stats.rejected).toBe(1);
    expect(stats.validated).toBe(0);
    const result = JSON.parse(fs.readFileSync(path.join(sharedDir, 'results', 'TXN006.json'), 'utf8'));
    expect(result.data.rejection_reason).toMatch(/Invalid ISO 4217/);
    expect(result.data.status).toBe('rejected');
  });

  it('processes multiple transactions correctly', () => {
    const sharedDir = makeSharedDirs();
    writeInputMessage(sharedDir, 'TXN001', makeTxn({ transaction_id: 'TXN001' }));
    writeInputMessage(sharedDir, 'TXN006', makeTxn({ transaction_id: 'TXN006', currency: 'XYZ' }));
    writeInputMessage(sharedDir, 'TXN007', makeTxn({ transaction_id: 'TXN007', amount: '-100.00' }));

    const stats = process(sharedDir);

    expect(stats.validated).toBe(1);
    expect(stats.rejected).toBe(2);
  });

  it('validated message has correct message_type', () => {
    const sharedDir = makeSharedDirs();
    writeInputMessage(sharedDir, 'TXN001', makeTxn());
    process(sharedDir);

    const message = JSON.parse(fs.readFileSync(path.join(sharedDir, 'output', 'TXN001.json'), 'utf8'));
    expect(message.message_type).toBe('validated');
    expect(message.source_agent).toBe('transaction_validator');
    expect(message.target_agent).toBe('fraud_detector');
  });
});
