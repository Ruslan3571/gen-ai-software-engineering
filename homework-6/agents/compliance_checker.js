const fs = require('fs');
const path = require('path');

const { Decimal } = require('decimal.js');

const {
  SUSPICIOUS_ACCOUNTS,
  AML_THRESHOLD,
  RISK_LEVELS,
  MESSAGE_TYPES,
  TRANSACTION_STATUSES,
  COMPLIANCE_FLAGS,
} = require('../src/constants');
const { createMessage } = require('../src/utils/message');
const { log } = require('../src/utils/logger');

const AGENT_NAME = 'compliance_checker';

const checkCompliance = (transaction) => {
  const flags = [];
  const amount = new Decimal(String(transaction.amount));

  if (SUSPICIOUS_ACCOUNTS.has(transaction.destination_account)) {
    flags.push(COMPLIANCE_FLAGS.SUSPICIOUS_DESTINATION);
  }

  if (amount.gte(AML_THRESHOLD)) {
    flags.push(COMPLIANCE_FLAGS.AML_REPORTING_REQUIRED);
  }

  if (transaction.risk_level === RISK_LEVELS.CRITICAL) {
    flags.push(COMPLIANCE_FLAGS.MANUAL_REVIEW_REQUIRED);
  }

  const status = flags.length === 0
    ? TRANSACTION_STATUSES.COMPLIANT
    : TRANSACTION_STATUSES.FLAGGED;

  return { status, flags };
};

const process = (sharedDir) => {
  const outputDir = path.join(sharedDir, 'output');
  const resultsDir = path.join(sharedDir, 'results');

  const files = fs.readdirSync(outputDir).filter((f) => f.endsWith('.json'));
  const stats = { compliant: 0, flagged: 0 };

  for (const file of files) {
    const filePath = path.join(outputDir, file);
    const message = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (message.message_type !== MESSAGE_TYPES.FRAUD_SCORED) continue;

    const transaction = message.data;
    const { status, flags } = checkCompliance(transaction);

    const outMessage = createMessage(
      AGENT_NAME,
      'results',
      MESSAGE_TYPES.COMPLIANCE_REVIEWED,
      { ...transaction, status, compliance_flags: flags },
    );

    fs.writeFileSync(path.join(resultsDir, file), JSON.stringify(outMessage, null, 2));
    fs.unlinkSync(filePath);

    if (status === TRANSACTION_STATUSES.COMPLIANT) {
      stats.compliant++;
    } else {
      stats.flagged++;
    }

    log(AGENT_NAME, transaction.transaction_id, `${status} [${flags.join(', ') || 'none'}]`);
  }

  return stats;
};

module.exports = { checkCompliance, process };
