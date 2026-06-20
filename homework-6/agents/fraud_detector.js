const fs = require('fs');
const path = require('path');

const { Decimal } = require('decimal.js');

const {
  FRAUD_THRESHOLDS,
  RISK_LEVELS,
  RISK_SCORE_THRESHOLDS,
  RISK_WEIGHTS,
  SUSPICIOUS_HOURS,
  MESSAGE_TYPES,
  TRANSACTION_STATUSES,
} = require('../src/constants');
const { createMessage } = require('../src/utils/message');
const { log } = require('../src/utils/logger');

const AGENT_NAME = 'fraud_detector';

const calculateRiskScore = (transaction) => {
  let score = new Decimal('0');
  const factors = [];

  const amount = new Decimal(String(transaction.amount));
  const hour = new Date(transaction.timestamp).getUTCHours();
  const country = (transaction.metadata && transaction.metadata.country) || 'US';

  if (amount.gte(FRAUD_THRESHOLDS.HIGH_VALUE)) {
    score = score.plus(RISK_WEIGHTS.HIGH_VALUE);
    factors.push('high_value_transaction');
  } else if (amount.gte(FRAUD_THRESHOLDS.STRUCTURING_LOW)) {
    score = score.plus(RISK_WEIGHTS.STRUCTURING);
    factors.push('structuring_threshold');
  }

  if (hour >= SUSPICIOUS_HOURS.START && hour < SUSPICIOUS_HOURS.END) {
    score = score.plus(RISK_WEIGHTS.UNUSUAL_HOUR);
    factors.push('unusual_hour');
  }

  if (country !== 'US') {
    score = score.plus(RISK_WEIGHTS.CROSS_BORDER);
    factors.push('cross_border');
  }

  let riskLevel;
  if (score.gte(RISK_SCORE_THRESHOLDS.CRITICAL)) {
    riskLevel = RISK_LEVELS.CRITICAL;
  } else if (score.gte(RISK_SCORE_THRESHOLDS.HIGH)) {
    riskLevel = RISK_LEVELS.HIGH;
  } else if (score.gte(RISK_SCORE_THRESHOLDS.MEDIUM)) {
    riskLevel = RISK_LEVELS.MEDIUM;
  } else {
    riskLevel = RISK_LEVELS.LOW;
  }

  return { score: score.toFixed(2), riskLevel, factors };
};

const process = (sharedDir) => {
  const outputDir = path.join(sharedDir, 'output');
  const resultsDir = path.join(sharedDir, 'results');

  const files = fs.readdirSync(outputDir).filter((f) => f.endsWith('.json'));
  const stats = { low: 0, elevated: 0 };

  for (const file of files) {
    const filePath = path.join(outputDir, file);
    const message = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (message.message_type !== MESSAGE_TYPES.VALIDATED) continue;

    const transaction = message.data;
    const { score, riskLevel, factors } = calculateRiskScore(transaction);

    const enrichedData = {
      ...transaction,
      status: TRANSACTION_STATUSES.FRAUD_SCORED,
      risk_score: score,
      risk_level: riskLevel,
      risk_factors: factors,
    };

    if (riskLevel === RISK_LEVELS.LOW) {
      const outMessage = createMessage(
        AGENT_NAME,
        'results',
        MESSAGE_TYPES.FRAUD_SCORED,
        { ...enrichedData, status: TRANSACTION_STATUSES.COMPLIANT },
      );
      fs.writeFileSync(path.join(resultsDir, file), JSON.stringify(outMessage, null, 2));
      fs.unlinkSync(filePath);
      stats.low++;
      log(AGENT_NAME, transaction.transaction_id, `LOW risk (${score}) → compliant`);
    } else {
      const outMessage = createMessage(
        AGENT_NAME,
        'compliance_checker',
        MESSAGE_TYPES.FRAUD_SCORED,
        enrichedData,
      );
      fs.writeFileSync(filePath, JSON.stringify(outMessage, null, 2));
      stats.elevated++;
      log(AGENT_NAME, transaction.transaction_id, `${riskLevel} risk (${score}) → compliance check`);
    }
  }

  return stats;
};

module.exports = { calculateRiskScore, process };
