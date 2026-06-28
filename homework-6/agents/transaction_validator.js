const fs = require('fs');
const path = require('path');

const { Decimal } = require('decimal.js');

const {
  REQUIRED_TRANSACTION_FIELDS,
  ISO_4217_CURRENCIES,
  MESSAGE_TYPES,
  TRANSACTION_STATUSES,
} = require('../src/constants');
const { createMessage } = require('../src/utils/message');
const { log } = require('../src/utils/logger');

const AGENT_NAME = 'transaction_validator';

const validate = (transaction) => {
  for (const field of REQUIRED_TRANSACTION_FIELDS) {
    const value = transaction[field];
    if (value === undefined || value === null || value === '') {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }

  let amount;
  try {
    amount = new Decimal(String(transaction.amount));
  } catch {
    return { valid: false, reason: `Invalid amount format: ${transaction.amount}` };
  }

  if (amount.lte(0)) {
    return { valid: false, reason: `Amount must be positive, got: ${transaction.amount}` };
  }

  if (!ISO_4217_CURRENCIES.has(transaction.currency)) {
    return { valid: false, reason: `Invalid ISO 4217 currency code: ${transaction.currency}` };
  }

  const parsed = new Date(transaction.timestamp);
  if (isNaN(parsed.getTime())) {
    return { valid: false, reason: `Invalid ISO 8601 timestamp: ${transaction.timestamp}` };
  }

  return { valid: true, reason: null };
};

const process = (sharedDir) => {
  const inputDir = path.join(sharedDir, 'input');
  const outputDir = path.join(sharedDir, 'output');
  const resultsDir = path.join(sharedDir, 'results');

  const files = fs.readdirSync(inputDir).filter((f) => f.endsWith('.json'));
  const stats = { validated: 0, rejected: 0 };

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const message = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const transaction = message.data;

    const { valid, reason } = validate(transaction);

    if (valid) {
      const outMessage = createMessage(
        AGENT_NAME,
        'fraud_detector',
        MESSAGE_TYPES.VALIDATED,
        { ...transaction, status: TRANSACTION_STATUSES.VALIDATED },
      );
      fs.writeFileSync(path.join(outputDir, file), JSON.stringify(outMessage, null, 2));
      stats.validated++;
      log(AGENT_NAME, transaction.transaction_id, 'validated');
    } else {
      const outMessage = createMessage(
        AGENT_NAME,
        'results',
        MESSAGE_TYPES.REJECTED,
        { ...transaction, status: TRANSACTION_STATUSES.REJECTED, rejection_reason: reason },
      );
      fs.writeFileSync(path.join(resultsDir, file), JSON.stringify(outMessage, null, 2));
      stats.rejected++;
      log(AGENT_NAME, transaction.transaction_id, `rejected: ${reason}`);
    }

    fs.unlinkSync(filePath);
  }

  return stats;
};

const runDryRun = () => {
  const samplePath = path.join(__dirname, '..', 'sample-transactions.json');
  const transactions = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

  console.log('\nDry-run validation — sample-transactions.json\n');
  console.log('ID       Status    Reason');
  console.log('─'.repeat(60));

  let validCount = 0;
  let invalidCount = 0;

  for (const txn of transactions) {
    const { valid, reason } = validate(txn);
    const status = valid ? 'VALID   ' : 'INVALID ';
    console.log(`${txn.transaction_id}  ${status}  ${reason || '—'}`);
    if (valid) validCount++;
    else invalidCount++;
  }

  console.log('─'.repeat(60));
  console.log(`Total: ${transactions.length}  Valid: ${validCount}  Invalid: ${invalidCount}\n`);
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    runDryRun();
  }
}

module.exports = { validate, process };
